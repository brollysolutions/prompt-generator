const API_URL = "https://brollysolutions.in/prompt_generator/api/enhance-prompt";
const INSTRUCTION = "Improve this into a clear, specific, high-quality AI prompt while preserving the user's original intent.";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "enhance-prompt",
    title: "Enhance Prompt",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "enhance-prompt" || !info.selectionText || !tab?.id) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: info.selectionText, instruction: INSTRUCTION })
    });
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
    if (typeof payload.enhanced_prompt !== "string" || !payload.enhanced_prompt.trim()) {
      throw new Error("The API returned no enhanced prompt.");
    }
    await chrome.tabs.sendMessage(tab.id, {
      type: "show-enhanced-prompt",
      prompt: payload.enhanced_prompt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enhance the prompt.";
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "show-error", message });
    } catch {
      console.warn("Prompt Generator could not display the error:", message);
    }
  }
});
