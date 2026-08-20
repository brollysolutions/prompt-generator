(() => {
  const HOST_ID = "prompt-generator-enhancer-host";
  let host;
  let shadowRoot;

  function ensureUI() {
    if (host?.isConnected) return shadowRoot;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.hidden = true;
    host.setAttribute("aria-live", "polite");
    shadowRoot = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    fetch(chrome.runtime.getURL("content.css"))
      .then((response) => response.text())
      .then((css) => { style.textContent = css; })
      .catch(() => { style.textContent = ".pge-card{font-family:Arial,sans-serif}"; });
    shadowRoot.append(style);

    const card = document.createElement("section");
    card.className = "pge-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Enhanced prompt");
    card.innerHTML = `
      <div class="pge-header">
        <div><span class="pge-eyebrow">Prompt Generator</span><h2>Enhanced prompt</h2></div>
        <button class="pge-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="pge-body"><pre class="pge-result"></pre><p class="pge-status" role="status"></p></div>
      <div class="pge-actions"><button class="pge-copy" type="button">Copy prompt</button><button class="pge-dismiss" type="button">Close</button></div>`;
    shadowRoot.append(card);
    card.querySelector(".pge-close").addEventListener("click", hide);
    card.querySelector(".pge-dismiss").addEventListener("click", hide);
    card.querySelector(".pge-copy").addEventListener("click", copyPrompt);
    document.documentElement.append(host);
    return shadowRoot;
  }

  function showPrompt(prompt) {
    const root = ensureUI();
    root.querySelector(".pge-result").textContent = prompt;
    root.querySelector(".pge-status").textContent = "";
    root.querySelector(".pge-copy").disabled = false;
    host.hidden = false;
  }

  function showError(message) {
    const root = ensureUI();
    root.querySelector(".pge-result").textContent = "We couldn't enhance that selection.";
    root.querySelector(".pge-status").textContent = message;
    root.querySelector(".pge-copy").disabled = true;
    host.hidden = false;
  }

  async function copyPrompt() {
    const root = shadowRoot;
    const text = root.querySelector(".pge-result").textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    root.querySelector(".pge-status").textContent = "Copied to clipboard.";
  }

  function hide() { if (host) host.hidden = true; }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "show-enhanced-prompt") showPrompt(message.prompt);
    if (message.type === "show-error") showError(message.message);
  });
})();
