/**
 * Popup UI. Runs on the extension origin, so it may call the backend directly
 * through the shared api module. Page-facing work (reading the selection,
 * showing the result panel, inserting text) is delegated to the background
 * worker, which owns all tab messaging.
 */

import {
  ApiError,
  login,
  logout,
  getSession,
  getApiBase,
  setApiBase,
  DEFAULT_API_BASE,
  generateQuestions,
  generateFinalPrompt,
  scorePrompt,
  saveToLibrary,
  testPrompt,
  getLibrary
} from "./api.js";

const el = (id) => document.getElementById(id);

const LOCAL_ORIGINS = ["http://localhost/*", "http://127.0.0.1/*"];

const VIEWS = {
  home: { title: "Smart Prompt Generator", back: null },
  questions: { title: "A few quick questions", back: "home" },
  result: { title: "Generated Prompt", back: "home" },
  test: { title: "Prompt Test", back: "result" },
  library: { title: "My Library", back: "home" }
};

/** Everything the result view is currently showing. */
const draft = { prompt: "", title: "", summary: "", score: null, criteria: {}, testResponse: "" };

/** The in-flight generation run, so "Create Prompt" can reuse the questions. */
let pendingGeneration = { idea: "", questions: [] };

// ------------------------------------------------------------------ status

let statusTimer = 0;

function setStatus(text, tone = "neutral") {
  const node = el("status");
  node.textContent = text || "";
  node.dataset.tone = tone;
  if (statusTimer) clearTimeout(statusTimer);
  if (text && tone === "success") {
    statusTimer = setTimeout(() => {
      if (node.textContent === text) node.textContent = "";
    }, 5000);
  }
}

function setBusy(text) {
  const box = el("busy");
  if (text) {
    el("busy-text").textContent = text;
    box.hidden = false;
  } else {
    box.hidden = true;
  }
  // Disable every action while a request is in flight so a slow LLM call
  // cannot be double-submitted.
  document.querySelectorAll("button.btn").forEach((button) => {
    button.disabled = Boolean(text);
  });
}

/**
 * ApiError messages are written for users, so they are safe to show. Anything
 * else is an unexpected internal failure and gets a generic message. Matching
 * on `name` as well as `instanceof` keeps this working if the error crosses a
 * module realm boundary.
 */
function isUserFacing(error) {
  return Boolean(error) && (error instanceof ApiError || error.name === "ApiError");
}

function reportError(error) {
  setBusy("");
  setStatus(isUserFacing(error) ? error.message : "Something went wrong.", "error");
}

// ------------------------------------------------------------------- views

let currentView = "home";

function showView(name) {
  currentView = name;
  Object.keys(VIEWS).forEach((key) => {
    el(`view-${key}`).hidden = key !== name;
  });
  el("view-title").textContent = VIEWS[name].title;
  el("back-btn").hidden = !VIEWS[name].back;
  // The tip and settings only make sense on the landing view.
  el("home-tip").hidden = name !== "home";
  el("settings-block").hidden = name !== "home";
  setStatus("");
}

function bindNav() {
  el("back-btn").addEventListener("click", () => {
    const back = VIEWS[currentView].back;
    if (back) showView(back);
  });
}

// -------------------------------------------------------------- auth state

async function renderAccount() {
  const session = await getSession();
  const signedIn = el("account-signed-in");
  const signedOut = el("account-signed-out");

  if (session) {
    el("account-email").textContent = session.email || "";
    signedIn.hidden = false;
    signedOut.hidden = true;
  } else {
    signedIn.hidden = true;
    signedOut.hidden = false;
    el("login-form").hidden = true;
    el("show-login").hidden = false;
  }
}

function bindAuth() {
  el("show-login").addEventListener("click", () => {
    el("show-login").hidden = true;
    el("login-form").hidden = false;
    el("login-email").focus();
  });

  el("login-cancel").addEventListener("click", () => {
    el("login-form").hidden = true;
    el("show-login").hidden = false;
    el("login-error").hidden = true;
  });

  el("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = el("login-email").value.trim();
    const password = el("login-password").value;
    const errorNode = el("login-error");
    errorNode.hidden = true;

    if (!email || !password) {
      errorNode.textContent = "Enter your email and password.";
      errorNode.hidden = false;
      return;
    }

    const submit = el("login-submit");
    submit.disabled = true;
    submit.textContent = "Logging in...";
    try {
      await login(email, password);
      el("login-password").value = "";
      await renderAccount();
      setStatus("Logged in.", "success");
    } catch (error) {
      errorNode.textContent = (error && error.message) || "Login failed.";
      errorNode.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Log in";
    }
  });

  el("logout-btn").addEventListener("click", async () => {
    await logout();
    await renderAccount();
    setStatus("Logged out.", "neutral");
  });
}

// ------------------------------------------------------------- last score

async function renderLastScore() {
  const stored = await chrome.storage.local.get("lastScore");
  const last = stored.lastScore;
  const list = el("score-breakdown");
  list.replaceChildren();

  if (!last || typeof last.score !== "number") {
    el("score-number").textContent = "--";
    el("score-meta").textContent = "Run a score to see the breakdown.";
    return;
  }

  el("score-number").textContent = String(last.score);
  renderBreakdown(list, last.criteria);
  el("score-meta").textContent = last.at ? `Last scored ${formatWhen(last.at)}.` : "";
}

function renderBreakdown(list, criteria) {
  list.replaceChildren();
  Object.entries(criteria || {}).forEach(([label, value]) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = label;
    const num = document.createElement("span");
    num.textContent = `${value}/20`;
    item.append(name, num);
    list.append(item);
  });
}

function formatWhen(timestamp) {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) return "just now";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ------------------------------------------------------- selection actions

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && typeof tab.id === "number" ? tab : null;
}

/** Reads the current selection from the active tab's top frame. */
async function readSelection(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selected = String(window.getSelection() || "");
      if (selected.trim()) return selected;
      // Fall back to a selection inside a focused input/textarea.
      const active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
        const { selectionStart, selectionEnd, value } = active;
        if (typeof selectionStart === "number" && selectionEnd > selectionStart) {
          return String(value).slice(selectionStart, selectionEnd);
        }
      }
      return "";
    }
  });
  const text = results && results[0] && typeof results[0].result === "string" ? results[0].result : "";
  return text.trim();
}

async function runSelectionAction(action) {
  const enhanceBtn = el("enhance-btn");
  const scoreBtn = el("score-btn");
  enhanceBtn.disabled = true;
  scoreBtn.disabled = true;
  setStatus("Reading your selection...");

  try {
    const tab = await getActiveTab();
    if (!tab) {
      setStatus("No active tab found.", "error");
      return;
    }

    let selection = "";
    try {
      selection = await readSelection(tab.id);
    } catch {
      setStatus("This page does not allow the extension to run.", "error");
      return;
    }

    if (!selection) {
      setStatus("Please select some text first.", "error");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: action === "enhance" ? "sp:run-enhance" : "sp:run-score",
      tabId: tab.id,
      selection
    });

    if (response && response.ok === false) {
      setStatus(response.message || "Could not start. Please try again.", "error");
      return;
    }

    setStatus("Working... the result opens on the page.", "neutral");
    // Close so the in-page panel is visible while the request completes.
    setTimeout(() => window.close(), 400);
  } catch (error) {
    setStatus((error && error.message) || "Something went wrong.", "error");
  } finally {
    enhanceBtn.disabled = false;
    scoreBtn.disabled = false;
  }
}

// ------------------------------------------------------------- generation

function bindGenerate() {
  el("generate-btn").addEventListener("click", () => void startGeneration());
  el("questions-submit").addEventListener("click", () => void finishGeneration(true));
  el("questions-skip").addEventListener("click", () => void finishGeneration(false));
}

/** Step 1: ask the backend which follow-up questions matter for this idea. */
async function startGeneration() {
  const idea = el("idea-input").value.trim();
  if (!idea) {
    setStatus("Describe what you want to create first.", "error");
    el("idea-input").focus();
    return;
  }

  setBusy("Thinking about your idea...");
  try {
    const questions = await generateQuestions(idea);
    pendingGeneration = { idea, questions };
    setBusy("");
    if (!questions.length) {
      // No questions came back; go straight to generation.
      await finishGeneration(false);
      return;
    }
    renderQuestions(questions);
    showView("questions");
  } catch (error) {
    reportError(error);
  }
}

function renderQuestions(questions) {
  const list = el("questions-list");
  list.replaceChildren();

  questions.forEach((question, index) => {
    const block = document.createElement("div");
    block.className = "question";

    const text = document.createElement("p");
    text.className = "question-text";
    text.textContent = `${index + 1}. ${question.question}`;
    block.append(text);

    question.options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "option";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = option;
      box.dataset.questionIndex = String(index);
      const caption = document.createElement("span");
      caption.textContent = option;
      label.append(box, caption);
      block.append(label);
    });

    list.append(block);
  });
}

/** Collects checked options into the `{ "0": "a, b" }` shape the backend reads. */
function collectAnswers() {
  const answers = {};
  document.querySelectorAll("#questions-list input[type=checkbox]:checked").forEach((box) => {
    const key = box.dataset.questionIndex;
    answers[key] = answers[key] ? `${answers[key]}, ${box.value}` : box.value;
  });
  return answers;
}

/** Step 2: turn the idea (plus any answers) into the final prompt. */
async function finishGeneration(useAnswers) {
  const { idea, questions } = pendingGeneration;
  if (!idea) {
    showView("home");
    return;
  }

  const answers = useAnswers ? collectAnswers() : {};
  setBusy("Writing your prompt...");
  try {
    const result = await generateFinalPrompt({ userInput: idea, answers, questions });
    setBusy("");
    showResult(result);
    if (typeof result.score === "number") {
      await rememberScore(result.score, result.criteria);
      await renderLastScore();
    }
  } catch (error) {
    reportError(error);
  }
}

async function rememberScore(score, criteria) {
  try {
    await chrome.storage.local.set({ lastScore: { score, criteria: criteria || {}, at: Date.now() } });
  } catch {
    // Storage is non-critical.
  }
}

// ----------------------------------------------------------- result view

function showResult({ title, summary, prompt, score, criteria }) {
  draft.prompt = prompt;
  draft.title = title || "Generated Prompt";
  draft.summary = summary || "";
  draft.score = typeof score === "number" ? score : null;
  draft.criteria = criteria || {};

  el("result-title").textContent = draft.title;
  el("result-summary").textContent = draft.summary;
  el("result-prompt").textContent = draft.prompt;
  el("result-score").textContent = draft.score === null ? "--" : String(draft.score);
  renderBreakdown(el("result-breakdown"), draft.criteria);
  showView("result");
}

function bindResult() {
  el("result-copy").addEventListener("click", () => void copyText(draft.prompt, "Prompt copied."));
  el("result-insert").addEventListener("click", () => void insertPromptOnPage(draft.prompt));
  el("result-score-btn").addEventListener("click", () => void rescoreDraft());
  el("result-save").addEventListener("click", () => void saveDraft());
}

/**
 * Inserts `text` into whatever the active page's focused (or last-focused)
 * input is. The popup has no page DOM access itself, so this always goes
 * through background.js, which relays it to content.js -- the only place
 * that actually touches the page.
 */
async function insertPromptOnPage(text) {
  if (!text) return;
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("No active tab found.", "error");
    return;
  }
  setBusy("Inserting into the page...");
  try {
    const response = await chrome.runtime.sendMessage({ type: "sp:insert-request", tabId: tab.id, prompt: text });
    setBusy("");
    if (response && response.ok) {
      setStatus(response.message || "Inserted into the page.", "success");
    } else {
      setStatus((response && response.message) || "Could not insert. Please try again.", "error");
    }
  } catch (error) {
    reportError(error);
  }
}

async function copyText(text, successMessage) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage, "success");
  } catch {
    setStatus("Copy failed. Select the text and copy manually.", "error");
  }
}

async function rescoreDraft() {
  if (!draft.prompt) return;
  setBusy("Scoring the prompt...");
  try {
    const result = await scorePrompt(draft.prompt);
    setBusy("");
    draft.score = result.score;
    draft.criteria = result.criteria;
    el("result-score").textContent = String(result.score);
    renderBreakdown(el("result-breakdown"), result.criteria);
    await rememberScore(result.score, result.criteria);
    await renderLastScore();
    setStatus("Scored.", "success");
  } catch (error) {
    reportError(error);
  }
}

async function saveDraft() {
  if (!draft.prompt) return;
  const session = await getSession();
  if (!session) {
    setStatus("Log in below to save prompts to your Library.", "error");
    return;
  }
  setBusy("Saving to your Library...");
  try {
    const result = await saveToLibrary(draft.prompt);
    setBusy("");
    setStatus(
      result.saved
        ? `Saved to your Library as "${result.name}".`
        : "Saved to your history. The Library entry is still being categorized.",
      "success"
    );
  } catch (error) {
    reportError(error);
  }
}

// ----------------------------------------------------------------- library

/** The last GET /library payload, filtered client-side by the search box. */
let libraryPrompts = [];

function bindLibrary() {
  el("library-btn").addEventListener("click", () => void openLibrary());
  el("library-search").addEventListener("input", () => renderLibrary());
}

async function openLibrary() {
  const session = await getSession();
  if (!session) {
    libraryPrompts = [];
    el("library-search").value = "";
    el("library-list").replaceChildren();
    showView("library");
    setLibraryMessage("Please log in to view your Library.");
    return;
  }

  setBusy("Loading your Library...");
  try {
    libraryPrompts = await getLibrary();
    setBusy("");
    el("library-search").value = "";
    showView("library");
    renderLibrary();
  } catch (error) {
    reportError(error);
  }
}

function setLibraryMessage(text) {
  const node = el("library-message");
  node.textContent = text || "";
  node.hidden = !text;
}

function renderLibrary() {
  const query = el("library-search").value.trim().toLowerCase();
  const list = el("library-list");
  list.replaceChildren();

  if (!libraryPrompts.length) {
    setLibraryMessage("Your Library is empty. Generate or save a prompt to fill it.");
    return;
  }

  // The backend returns { id, name, prompt_text, tags, category, created_at }.
  const matches = libraryPrompts.filter((item) => {
    if (!query) return true;
    const haystack = [
      item.name,
      item.category,
      item.prompt_text,
      Array.isArray(item.tags) ? item.tags.join(" ") : ""
    ]
      .filter((part) => typeof part === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  if (!matches.length) {
    setLibraryMessage("No prompts match that search.");
    return;
  }
  setLibraryMessage("");

  matches.forEach((item) => list.append(buildLibraryRow(item)));
}

function buildLibraryRow(item) {
  const row = document.createElement("li");

  const name = document.createElement("p");
  name.className = "library-name";
  name.textContent = item.name || "Untitled prompt";

  const meta = document.createElement("p");
  meta.className = "library-meta";
  meta.textContent = [item.category, formatDate(item.created_at)].filter(Boolean).join(" - ");

  const actions = document.createElement("div");
  actions.className = "library-actions";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn-secondary";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => void copyText(item.prompt_text, "Prompt copied."));

  const insert = document.createElement("button");
  insert.type = "button";
  insert.className = "btn btn-secondary";
  insert.textContent = "Insert";
  insert.addEventListener("click", () => void insertPromptOnPage(item.prompt_text));

  actions.append(copy, insert);
  row.append(name, meta, actions);
  return row;
}

function formatDate(value) {
  if (typeof value !== "string" || !value) return "";
  // SQLite hands back "YYYY-MM-DD HH:MM:SS"; keep the date part if it parses.
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

// ------------------------------------------------------------- test prompt

function bindTest() {
  el("result-test").addEventListener("click", () => void runTest());
  el("test-copy").addEventListener("click", () => void copyText(draft.testResponse, "Response copied."));
  // Saving from the test view saves the prompt, not the AI's answer.
  el("test-save").addEventListener("click", () => void saveDraft());
}

/** Runs the prompt through the backend so the user can see what it produces. */
async function runTest() {
  if (!draft.prompt) return;
  setBusy("Running your prompt...");
  try {
    const response = await testPrompt(draft.prompt);
    setBusy("");
    draft.testResponse = response;
    el("test-prompt-text").textContent = draft.prompt;
    el("test-response").textContent = response;
    showView("test");
  } catch (error) {
    reportError(error);
  }
}

function bindActions() {
  el("enhance-btn").addEventListener("click", () => void runSelectionAction("enhance"));
  el("score-btn").addEventListener("click", () => void runSelectionAction("score"));
}

// ---------------------------------------------------------------- settings

async function renderSettings() {
  el("api-base").value = await getApiBase();
}

function originPatternFor(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return "";
  }
}

function bindSettings() {
  // Deliberately not async: chrome.permissions.request() must run inside the
  // click's user gesture, and an `await` before it would consume the gesture.
  el("api-save").addEventListener("click", () => {
    const value = el("api-base").value.trim();
    const note = el("settings-status");

    const commit = (url) => {
      setApiBase(url)
        .then(() => renderSettings())
        .then(() => {
          note.textContent = url ? "Saved." : "Reset to the default API.";
        });
    };

    if (!value) {
      commit("");
      return;
    }

    const pattern = originPatternFor(value);
    if (!pattern) {
      note.textContent = "Enter a full URL, for example http://localhost:8000";
      return;
    }

    // The production host is a declared host permission, so it needs no prompt.
    if (`${DEFAULT_API_BASE}/`.startsWith(pattern.replace(/\*$/, ""))) {
      commit(value);
      return;
    }

    if (!LOCAL_ORIGINS.includes(pattern)) {
      note.textContent = "Only the production API and localhost are supported.";
      return;
    }

    chrome.permissions
      .request({ origins: [pattern] })
      .then((granted) => {
        if (!granted) {
          note.textContent = "Permission denied, so the URL was not saved.";
          return;
        }
        commit(value);
      })
      .catch(() => {
        note.textContent = "Could not request access to that host.";
      });
  });

  el("api-reset").addEventListener("click", async () => {
    await setApiBase("");
    el("api-base").value = DEFAULT_API_BASE;
    el("settings-status").textContent = "Reset to the default API.";
  });
}

// -------------------------------------------------------------- bootstrap

bindNav();
bindAuth();
bindActions();
bindGenerate();
bindResult();
bindTest();
bindLibrary();
bindSettings();
showView("home");
void renderAccount();
void renderLastScore();
void renderSettings();
