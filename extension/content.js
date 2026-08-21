/**
 * On-page panel for the Smart Prompt Generator extension.
 *
 * Injected on demand by the background worker (activeTab), so this file may be
 * executed more than once in the same frame -- the guard below makes repeat
 * injections a no-op. It renders UI only: it performs no network calls and
 * never receives the user's auth token.
 */

(() => {
  if (window.__smartPromptGeneratorPanel) return;
  window.__smartPromptGeneratorPanel = true;

  // ---------------------------------------------------- insertion utilities
  //
  // Verified in real Chrome (chatgpt.com, claude.ai, gemini.google.com, plus a
  // plain textarea/input/contenteditable harness) before shipping:
  //   - <textarea>/<input>: write through the native value setter (bypasses a
  //     framework-shadowed `.value` property, e.g. React) and dispatch native
  //     `input`/`change` events so the framework's own change-tracker sees it.
  //   - contenteditable (ChatGPT/Claude's ProseMirror, Gemini's Quill editor):
  //     `document.execCommand("insertText", ...)` mutates through the editor's
  //     own beforeinput/input pipeline, which is what makes their Send button
  //     enable -- a raw textContent/Range write alone left Send disabled.

  function isUsableInput(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return !el.disabled && !el.readOnly;
    if (tag === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel"].includes(type) && !el.disabled && !el.readOnly;
    }
    if (el.isContentEditable) return true;
    const flag = el.getAttribute("contenteditable");
    return flag === "true" || flag === "";
  }

  // Remembers the last editable element the user actually focused, so Insert
  // still works after our own panel (a separate, focusable UI) has taken focus.
  let lastFocusedEditable = null;
  document.addEventListener(
    "focusin",
    (event) => {
      if (isUsableInput(event.target)) lastFocusedEditable = event.target;
    },
    true
  );

  function genericFindInput() {
    if (isUsableInput(document.activeElement)) return document.activeElement;
    if (lastFocusedEditable && document.contains(lastFocusedEditable) && isUsableInput(lastFocusedEditable)) {
      return lastFocusedEditable;
    }
    return null;
  }

  function nativeValueSetter(tagName) {
    const proto = tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, "value").set;
  }

  function dispatchChangeEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Inserts at the current selection (or replaces it) inside a textarea/input. */
  function insertIntoField(el, text) {
    const setter = nativeValueSetter(el.tagName);
    const start = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    setter.call(el, before + text + after);
    const caret = start + text.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // Some input types (e.g. email) reject setSelectionRange; the value is
      // already set, so this is cosmetic only.
    }
    dispatchChangeEvents(el);
  }

  /** Inserts at the current caret inside a contenteditable editor. */
  function insertIntoContentEditable(el, text) {
    el.focus();
    const selection = window.getSelection();
    if (!selection) return false;
    if (!(selection.rangeCount > 0 && el.contains(selection.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(range);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }

  function insertText(el, text) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      insertIntoField(el, text);
      return true;
    }
    return insertIntoContentEditable(el, text);
  }

  // ------------------------------------------------------- site adapters
  //
  // Each adapter tries its site's known composer selector first (so Insert
  // works even before the user has clicked into the box) and falls back to
  // whatever the user last focused. Selectors were read from the live DOM on
  // 2026-08-21; sites change markup without notice, so the fallback is load
  // bearing, not decorative.

  const siteAdapters = {
    chatgpt: {
      match: (hostname) => /(^|\.)chatgpt\.com$/.test(hostname),
      findInput() {
        const known = document.querySelector('#prompt-textarea, form textarea');
        return isUsableInput(known) ? known : genericFindInput();
      },
      insertText
    },
    claude: {
      match: (hostname) => /(^|\.)claude\.ai$/.test(hostname),
      findInput() {
        const known = document.querySelector(
          'div[aria-label="Write your prompt to Claude"][contenteditable="true"], div.ProseMirror[contenteditable="true"]'
        );
        return isUsableInput(known) ? known : genericFindInput();
      },
      insertText
    },
    gemini: {
      match: (hostname) => /(^|\.)gemini\.google\.com$/.test(hostname),
      findInput() {
        const known = document.querySelector(
          'div[aria-label="Enter a prompt for Gemini"][contenteditable="true"], .ql-editor[contenteditable="true"]'
        );
        return isUsableInput(known) ? known : genericFindInput();
      },
      insertText
    },
    generic: {
      match: () => true,
      findInput: genericFindInput,
      insertText
    }
  };

  function detectSite() {
    const hostname = location.hostname;
    return (
      Object.values(siteAdapters).find((adapter) => adapter !== siteAdapters.generic && adapter.match(hostname)) ||
      siteAdapters.generic
    );
  }

  /** @returns {{ok:boolean,message:string}} */
  function performInsert(text) {
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, message: "There is nothing to insert yet." };
    }
    const adapter = detectSite();
    const target = adapter.findInput() || (adapter === siteAdapters.generic ? null : siteAdapters.generic.findInput());
    if (!target) {
      return { ok: false, message: "Click inside a text box first, then try Insert Prompt again." };
    }
    try {
      adapter.insertText(target, text);
      return { ok: true, message: "Inserted into the page." };
    } catch {
      return { ok: false, message: "Could not insert automatically. Please paste manually." };
    }
  }

  const HOST_ID = "smart-prompt-generator-host";

  /** @type {HTMLElement|null} */ let host = null;
  /** @type {ShadowRoot|null} */ let root = null;
  let currentPrompt = "";
  let statusTimer = 0;

  // ------------------------------------------------------------------ setup

  function buildPanel() {
    if (host && host.isConnected && root) return root;

    host = document.createElement("div");
    host.id = HOST_ID;
    host.hidden = true;
    host.setAttribute("aria-live", "polite");
    root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = FALLBACK_CSS;
    root.append(style);
    // Upgrade to the full stylesheet once it loads; the inline fallback keeps
    // the panel readable if the fetch is blocked by a strict page policy.
    fetch(chrome.runtime.getURL("content.css"))
      .then((response) => (response.ok ? response.text() : ""))
      .then((css) => {
        if (css) style.textContent = css;
      })
      .catch(() => {});

    const card = document.createElement("section");
    card.className = "sp-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Smart Prompt Generator");
    card.innerHTML = `
      <header class="sp-header">
        <div class="sp-brand">
          <span class="sp-logo" aria-hidden="true">SP</span>
          <span>Smart Prompt Generator</span>
        </div>
        <button class="sp-icon-btn sp-close" type="button" aria-label="Close">&#10005;</button>
      </header>

      <div class="sp-body">
        <div class="sp-loading" hidden>
          <span class="sp-spinner" aria-hidden="true"></span>
          <span class="sp-loading-text">Working...</span>
        </div>

        <section class="sp-prompt-block" hidden>
          <h2 class="sp-heading">Enhanced Prompt</h2>
          <pre class="sp-prompt" tabindex="0"></pre>
        </section>

        <section class="sp-score-block" hidden>
          <h3 class="sp-subheading">Quality Score</h3>
          <div class="sp-score-value"><strong class="sp-score-number">--</strong><span>/ 100</span></div>
          <div class="sp-score-note"></div>
          <ul class="sp-criteria"></ul>
          <details class="sp-suggestions" hidden>
            <summary>Suggestions</summary>
            <ul></ul>
          </details>
        </section>

        <p class="sp-error" role="alert" hidden></p>
      </div>

      <footer class="sp-actions">
        <p class="sp-status" role="status"></p>
        <div class="sp-buttons">
          <button class="sp-btn sp-btn-primary sp-copy" type="button">Copy Prompt</button>
          <button class="sp-btn sp-btn-secondary sp-insert" type="button">Insert</button>
          <button class="sp-btn sp-btn-secondary sp-save" type="button">Save to Library</button>
          <button class="sp-btn sp-btn-ghost sp-dismiss" type="button">Close</button>
        </div>
      </footer>`;

    root.append(card);

    card.querySelector(".sp-close").addEventListener("click", hidePanel);
    card.querySelector(".sp-dismiss").addEventListener("click", hidePanel);
    card.querySelector(".sp-copy").addEventListener("click", handleCopy);
    card.querySelector(".sp-insert").addEventListener("click", handleInsert);
    card.querySelector(".sp-save").addEventListener("click", handleSave);

    document.documentElement.append(host);
    return root;
  }

  const FALLBACK_CSS = `
    .sp-card{position:fixed;top:24px;right:24px;z-index:2147483647;width:420px;max-width:calc(100vw - 48px);
      background:#fff;color:#172033;border:1px solid #dfe5ee;border-radius:16px;padding:16px;
      font:14px/1.5 system-ui,sans-serif;box-shadow:0 18px 50px rgba(25,39,68,.22)}
    .sp-prompt{white-space:pre-wrap;max-height:300px;overflow:auto}
    [hidden]{display:none !important}`;

  // ----------------------------------------------------------- panel state

  function $(selector) {
    return root.querySelector(selector);
  }

  function showPanel() {
    buildPanel();
    host.hidden = false;
  }

  function hidePanel() {
    if (host) host.hidden = true;
  }

  function setLoading(text) {
    const box = $(".sp-loading");
    if (text) {
      $(".sp-loading-text").textContent = text;
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  function setStatus(text, tone = "neutral") {
    const el = $(".sp-status");
    el.textContent = text || "";
    el.dataset.tone = tone;
    if (statusTimer) clearTimeout(statusTimer);
    if (text && tone === "success") {
      statusTimer = setTimeout(() => {
        if (el.textContent === text) el.textContent = "";
      }, 6000);
    }
  }

  function setError(message) {
    const el = $(".sp-error");
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function setActionsEnabled(enabled) {
    $(".sp-copy").disabled = !enabled;
    $(".sp-insert").disabled = !enabled;
    $(".sp-save").disabled = !enabled;
  }

  function resetForNewRun() {
    setError(null);
    setStatus("");
    $(".sp-prompt-block").hidden = true;
    $(".sp-score-block").hidden = true;
    $(".sp-suggestions").hidden = true;
    $(".sp-score-number").textContent = "--";
    $(".sp-score-note").textContent = "";
    $(".sp-criteria").replaceChildren();
    // Copy/Save always act on the prompt that is actually on screen, so clear
    // the buffer until a prompt is rendered.
    currentPrompt = "";
    setActionsEnabled(false);
  }

  function showPrompt(prompt, heading) {
    currentPrompt = prompt;
    $(".sp-heading").textContent = heading || "Enhanced Prompt";
    $(".sp-prompt").textContent = prompt;
    $(".sp-prompt-block").hidden = false;
    setActionsEnabled(true);
    setLoading("");
  }

  function showScore(score, criteria, suggestions) {
    $(".sp-score-block").hidden = false;
    $(".sp-score-number").textContent = String(score);
    $(".sp-score-note").textContent = "";

    const list = $(".sp-criteria");
    list.replaceChildren();
    // The backend returns five criteria scored 0-20 each; render whatever it
    // sends rather than hard-coding label names.
    Object.entries(criteria || {}).forEach(([label, rawValue]) => {
      const value = Number(rawValue);
      const item = document.createElement("li");

      const name = document.createElement("span");
      name.className = "sp-criteria-name";
      name.textContent = label;

      const bar = document.createElement("span");
      bar.className = "sp-bar";
      const fill = document.createElement("span");
      fill.className = "sp-bar-fill";
      fill.style.width = `${Math.max(0, Math.min(100, (Number.isFinite(value) ? value : 0) * 5))}%`;
      bar.append(fill);

      const num = document.createElement("span");
      num.className = "sp-criteria-value";
      num.textContent = Number.isFinite(value) ? `${value}/20` : "--";

      item.append(name, bar, num);
      list.append(item);
    });

    const details = $(".sp-suggestions");
    const suggestionList = details.querySelector("ul");
    suggestionList.replaceChildren();
    if (Array.isArray(suggestions) && suggestions.length) {
      suggestions.slice(0, 5).forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        suggestionList.append(li);
      });
      details.hidden = false;
    } else {
      details.hidden = true;
    }
    setLoading("");
  }

  // --------------------------------------------------------------- actions

  async function handleCopy() {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setStatus("Copied to clipboard.", "success");
      return;
    } catch {
      // Clipboard API is unavailable on some pages; fall back below.
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = currentPrompt;
      textarea.setAttribute("readonly", "");
      textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      setStatus(
        copied ? "Copied to clipboard." : "Copy failed. Select the text and copy manually.",
        copied ? "success" : "error"
      );
    } catch {
      setStatus("Copy failed. Select the text and copy manually.", "error");
    }
  }

  /**
   * The panel already runs in the page, so Insert acts directly on the DOM --
   * no messaging round trip needed here (that's only for the popup, which has
   * no page access of its own).
   */
  function handleInsert() {
    if (!currentPrompt) return;
    const result = performInsert(currentPrompt);
    setStatus(result.message, result.ok ? "success" : "error");
  }

  async function handleSave() {
    if (!currentPrompt) return;
    const button = $(".sp-save");
    button.disabled = true;
    setStatus("Saving...", "neutral");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "sp:save-request",
        prompt: currentPrompt
      });
      applySaveResult(response);
    } catch {
      setStatus("Unable to reach the extension. Try reloading the page.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function applySaveResult(result) {
    if (!result) {
      setStatus("Save failed. Please try again.", "error");
      return;
    }
    setStatus(result.message, result.ok ? "success" : "error");
  }

  // -------------------------------------------------------------- messages

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      sendResponse({ ok: false });
      return undefined;
    }

    switch (message.type) {
      case "sp:ping":
        break;

      // Requested by the popup via background.js (the popup has no page DOM
      // access of its own). Replies with the real outcome, so this returns
      // before the generic { ok: true } below.
      case "sp:insert":
        sendResponse(performInsert(message.prompt));
        return undefined;

      case "sp:open":
        showPanel();
        resetForNewRun();
        setLoading(message.stage === "enhancing" ? "Enhancing your prompt..." : "");
        break;

      case "sp:prompt":
        showPanel();
        showPrompt(message.prompt, message.heading);
        break;

      case "sp:scoring":
        showPanel();
        setLoading("Scoring the prompt...");
        break;

      case "sp:score":
        showPanel();
        showScore(message.score, message.criteria, message.suggestions);
        break;

      case "sp:score-error":
        showPanel();
        setLoading("");
        $(".sp-score-block").hidden = false;
        $(".sp-score-number").textContent = "--";
        $(".sp-score-note").textContent = message.message || "Scoring is unavailable right now.";
        break;

      case "sp:saving":
        showPanel();
        setStatus("Saving...", "neutral");
        break;

      case "sp:saved":
        showPanel();
        applySaveResult(message);
        break;

      case "sp:error":
        showPanel();
        setLoading("");
        setError(message.message || "Something went wrong.");
        setActionsEnabled(Boolean(currentPrompt));
        break;

      default:
        break;
    }

    // Always answer so the sender's sendMessage promise settles.
    sendResponse({ ok: true });
    return undefined;
  });
})();
