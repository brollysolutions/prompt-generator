# Prompt Generator Chrome Extension

This Manifest V3 extension enhances selected text on any webpage using the production Prompt Generator API.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` directory.
4. Select text on a webpage, right-click, and choose **Enhance Prompt**.

The enhanced result appears in a floating panel with **Copy prompt** and **Close** controls.

## Implementation notes

- API calls are made only by `background.js` and use `https://brollysolutions.in/prompt_generator/api/enhance-prompt`.
- No API keys or credentials are bundled in the extension.
- The floating panel uses a closed Shadow DOM and loads its styles from `content.css`.
- The extension requires network access to `https://brollysolutions.in/*` through `host_permissions`.
- This directory is self-contained and does not change the Prompt Generator backend, frontend, or deployment configuration.
