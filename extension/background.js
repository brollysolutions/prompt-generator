/**
 * Background service worker: the only place that talks to the backend on behalf
 * of a web page. Content scripts render UI and never hold the auth token.
 */

import { ApiError, enhancePrompt, scorePrompt, saveToLibrary, getSession } from "./api.js";

const MENU = {
  root: "smart-prompt-root",
  enhance: "smart-prompt-enhance",
  score: "smart-prompt-score",
  save: "smart-prompt-save"
};

// -------------------------------------------------------------- context menu

/**
 * Rebuild the menu from scratch. removeAll() first so a reload/update can never
 * stack duplicates or fail with "duplicate id". Only called from onInstalled --
 * context menus persist across browser restarts, so recreating them on every
 * service-worker wake-up would be wasted work.
 */
function buildContextMenus() {
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError; // nothing to remove on a fresh install
    chrome.contextMenus.create({ id: MENU.root, title: "Smart Prompt", contexts: ["selection"] });
    chrome.contextMenus.create({
      id: MENU.enhance,
      parentId: MENU.root,
      title: "Enhance Prompt",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: MENU.score,
      parentId: MENU.root,
      title: "Score Prompt",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: MENU.save,
      parentId: MENU.root,
      title: "Save Selection to Library",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(buildContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || typeof tab.id !== "number") return;
  const target = { tabId: tab.id, frameId: typeof info.frameId === "number" ? info.frameId : 0 };
  const selection = (info.selectionText || "").trim();

  if (info.menuItemId === MENU.enhance) void runEnhanceFlow(target, selection);
  else if (info.menuItemId === MENU.score) void runScoreOnlyFlow(target, selection);
  else if (info.menuItemId === MENU.save) void runSaveSelectionFlow(target, selection);
});

// -------------------------------------------------- content script plumbing

/**
 * Make sure the panel script is present in the target frame. The extension has
 * no <all_urls> content script; it injects on demand under `activeTab`, which
 * Chrome grants when the user invokes our context menu or toolbar action.
 */
async function ensureContentScript(target) {
  try {
    await chrome.tabs.sendMessage(target.tabId, { type: "sp:ping" }, { frameId: target.frameId });
    return true;
  } catch {
    // Not injected yet (or the worker restarted) -- inject and retry.
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: target.tabId, frameIds: [target.frameId] },
      files: ["content.js"]
    });
    return true;
  } catch (error) {
    console.warn("Smart Prompt Generator: cannot run on this page.", error && error.message);
    return false;
  }
}

async function send(target, message) {
  try {
    await chrome.tabs.sendMessage(target.tabId, message, { frameId: target.frameId });
  } catch {
    // The tab navigated away or the panel was closed; nothing to update.
  }
}

function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

// ------------------------------------------------------------------- flows

async function runEnhanceFlow(target, selection) {
  if (!(await ensureContentScript(target))) return;

  if (!selection) {
    await send(target, { type: "sp:error", message: "Please select some text first." });
    return;
  }

  await send(target, { type: "sp:open", stage: "enhancing" });

  let enhanced;
  try {
    enhanced = await enhancePrompt(selection);
  } catch (error) {
    await send(target, { type: "sp:error", message: errorMessage(error) });
    return;
  }
  await send(target, { type: "sp:prompt", prompt: enhanced, heading: "Enhanced Prompt" });
  await scoreInto(target, enhanced);
}

async function runScoreOnlyFlow(target, selection) {
  if (!(await ensureContentScript(target))) return;

  if (!selection) {
    await send(target, { type: "sp:error", message: "Please select some text first." });
    return;
  }
  await send(target, { type: "sp:open", stage: "ready" });
  await send(target, { type: "sp:prompt", prompt: selection, heading: "Selected Prompt" });
  await scoreInto(target, selection);
}

async function runSaveSelectionFlow(target, selection) {
  if (!(await ensureContentScript(target))) return;

  if (!selection) {
    await send(target, { type: "sp:error", message: "Please select some text first." });
    return;
  }
  await send(target, { type: "sp:open", stage: "ready" });
  await send(target, { type: "sp:prompt", prompt: selection, heading: "Selected Prompt" });
  await send(target, { type: "sp:saving" });
  const result = await performSave(selection);
  await send(target, { type: "sp:saved", ...result });
}

/** Scores `prompt` and streams the result into the panel. Never throws. */
async function scoreInto(target, prompt) {
  await send(target, { type: "sp:scoring" });
  try {
    const result = await scorePrompt(prompt);
    await rememberScore(result);
    await send(target, {
      type: "sp:score",
      score: result.score,
      criteria: result.criteria,
      suggestions: result.suggestions
    });
  } catch (error) {
    await send(target, { type: "sp:score-error", message: errorMessage(error) });
  }
}

/** Keeps the most recent score so the popup can show it on next open. */
async function rememberScore(result) {
  try {
    await chrome.storage.local.set({
      lastScore: { score: result.score, criteria: result.criteria, at: Date.now() }
    });
  } catch {
    // Storage is non-critical for the flow.
  }
}

/** @returns {Promise<{ok:boolean,message:string,needsLogin?:boolean}>} */
async function performSave(promptText) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      needsLogin: true,
      message: "Log in from the Smart Prompt Generator toolbar icon to save prompts."
    };
  }
  try {
    const result = await saveToLibrary(promptText);
    if (result.saved) {
      return { ok: true, message: `Saved to your Library as "${result.name}".` };
    }
    return {
      ok: true,
      message: "Saved to your history. The Library entry is still being categorized."
    };
  } catch (error) {
    return {
      ok: false,
      needsLogin: error instanceof ApiError && error.status === 401,
      message: errorMessage(error)
    };
  }
}

/**
 * Relays an Insert request from the popup to content.js, which owns all page
 * DOM interaction. background.js never touches the page itself -- it only
 * makes sure the content script is present and forwards the message.
 * @returns {Promise<{ok:boolean,message:string}>}
 */
async function relayInsert(tabId, prompt) {
  const target = { tabId, frameId: 0 };
  if (!(await ensureContentScript(target))) {
    return { ok: false, message: "This page does not allow the extension to run." };
  }
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "sp:insert", prompt }, { frameId: 0 });
    if (result && typeof result.ok === "boolean") return result;
    return { ok: false, message: "No response from the page." };
  } catch {
    return { ok: false, message: "Could not reach the page. Try reloading it." };
  }
}

// ------------------------------------------------- messages from the page UI

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return undefined;

  if (message.type === "sp:save-request") {
    const text = typeof message.prompt === "string" ? message.prompt.trim() : "";
    if (!text) {
      sendResponse({ ok: false, message: "There is nothing to save yet." });
      return undefined;
    }
    performSave(text).then(sendResponse);
    return true; // keep the channel open for the async response
  }

  if (message.type === "sp:insert-request") {
    const tabId = message.tabId;
    const prompt = typeof message.prompt === "string" ? message.prompt.trim() : "";
    if (typeof tabId !== "number" || !prompt) {
      sendResponse({ ok: false, message: "There is nothing to insert yet." });
      return undefined;
    }
    void relayInsert(tabId, prompt).then(sendResponse);
    return true; // keep the channel open for the async response
  }

  if (message.type === "sp:run-enhance" || message.type === "sp:run-score") {
    const tabId = message.tabId;
    const selection = typeof message.selection === "string" ? message.selection.trim() : "";
    if (typeof tabId !== "number" || !selection) {
      sendResponse({ ok: false, message: "Please select some text first." });
      return undefined;
    }
    const target = { tabId, frameId: 0 };
    const flow = message.type === "sp:run-enhance" ? runEnhanceFlow : runScoreOnlyFlow;
    // Answer immediately: the popup closes, and the flow reports into the page.
    sendResponse({ ok: true });
    void flow(target, selection);
    return undefined;
  }

  return undefined;
});
