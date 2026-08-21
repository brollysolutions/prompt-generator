# Smart Prompt Generator Chrome Extension

A Manifest V3 companion to the Smart Prompt Generator web app. It generates,
enhances, scores, tests, saves, and inserts prompts from any page by calling
the existing FastAPI backend — it contains no AI provider keys and no JWT
secret of its own.

## Architecture

```
Chrome extension  ->  FastAPI backend  ->  Groq / Gemini  ->  response
```

The extension never talks to an AI provider directly, and never duplicates the
backend's Hinglish/Teluglish language routing or its prompt-generation logic.

| File           | Role |
| -------------- | ---- |
| `api.js`       | Shared backend client: base URL, JWT storage, error mapping, endpoint wrappers. Imported by the service worker and the popup only. |
| `background.js`| Service worker. Owns the context menus and relays messages between the popup and the page; the only component that calls the backend on a page's behalf. |
| `content.js`   | Runs in the page. Renders the in-page result panel (closed Shadow DOM) and owns all page-DOM interaction, including the site-adapter Insert logic. No network calls, and it never receives the auth token. |
| `popup.js`     | Toolbar popup: Generate, Enhance/Score selection, Test, My Library, Insert, login/out, settings. |

`content.js` is **not** a declared content script. It is injected on demand
under `activeTab`, which Chrome grants when the user invokes the context menu or
clicks the toolbar icon, so the extension holds no `<all_urls>` host access.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` directory.
4. After any code change, press the **Reload** (circular arrow) button on the
   extension's card. Check the card's **Errors** button for runtime problems.

Reloading the unpacked extension does not fire `onInstalled`, so the context
menus persist from the previous load. If you ever need to rebuild them, remove
and re-add the extension.

## What it does

**Right-click a selection → Smart Prompt:**
- **Enhance Prompt** — `POST /enhance-prompt`, then auto `POST /score-prompt`.
- **Score Prompt** — scores the selection as-is.
- **Save Selection to Library**.

The on-page panel offers **Copy Prompt**, **Insert**, **Save to Library**, and
**Close**.

**Toolbar popup:**
- **Generate Prompt** — describe an idea, answer (or skip) a few backend-generated
  follow-up questions, get a finished prompt with its quality score.
- **Enhance/Score Selection** — same as the context menu, from the popup.
- **Test Prompt** — runs the current prompt through `/test-prompt` and shows the
  AI's actual response.
- **My Library** — browse, search, copy, and insert your saved prompts.
- **Insert** — sends the current prompt to the active tab's message box.
- Login/logout, last-score display, API base URL settings.

## Insert Prompt & site adapters

`content.js` implements a small adapter table (`siteAdapters = { chatgpt, claude,
gemini, generic }`), each providing `match()`, `findInput()`, and `insertText()`.
Every adapter falls back to `generic` (the currently or last-focused editable
element) if its site-specific selector doesn't resolve — so Insert keeps working
even if a site changes its markup, as long as the user has clicked into the
message box first.

Insertion never submits the message — the user still presses the site's own
Send button.

| Site | Composer selector used |
| ---- | ---- |
| chatgpt.com | `#prompt-textarea` (a ProseMirror `contenteditable` div), falls back to `form textarea` |
| claude.ai | `div[aria-label="Write your prompt to Claude"][contenteditable="true"]` (tiptap/ProseMirror) |
| gemini.google.com | `div[aria-label="Enter a prompt for Gemini"][contenteditable="true"]` (Quill `.ql-editor`) |
| any other site | the focused (or last-focused) `textarea` / `input[type=text|search|email|url|tel]` / `contenteditable` |

For `<textarea>`/`<input>`, insertion goes through the element's *native* value
setter (bypassing a framework's shadowed `.value` property, e.g. React) and
dispatches real `input`/`change` events, so framework-controlled inputs notice
the change. For `contenteditable` editors, insertion uses
`document.execCommand("insertText", ...)`, which is what makes ProseMirror/Quill
recognize the new content and enable their Send button; a manual Range-based
insert is the fallback if `execCommand` is unavailable or returns `false`.

If no usable input can be found, the panel/popup shows: *"Click inside a text
box first, then try Insert Prompt again."*

Selectors were read from the live DOM of chatgpt.com, claude.ai, and
gemini.google.com on 2026-08-21 via real-Chrome inspection — see the Phase 2
report for exactly what was verified there versus what is mocked-only.

## Backend endpoints used

All are pre-existing; the extension adds no backend functionality.

| Action | Endpoint |
| ------ | -------- |
| Log in | `POST /login` |
| Enhance | `POST /enhance-prompt` |
| Score | `POST /score-prompt` |
| Generate — questions | `POST /generate-questions` |
| Generate — final prompt | `POST /generate-final-prompt` |
| Test | `POST /test-prompt` |
| Library | `GET /library` |
| Save to Library | `POST /history` with `source: "edited (history)"` |
| Confirm the save | `GET /library` |

There is no "create library entry" endpoint. The web app saves to the Library
through `POST /history` with source `"edited (history)"`, which makes the
backend auto-categorize the text and write it to `library_prompts`. The
extension reuses that exact path. Because that library write is best-effort on
the server, the extension reads `GET /library` back to confirm the entry landed
rather than assuming success.

The backend answers `generate-final-prompt`/`test-prompt` failures with HTTP 200
and a fallback body (`title: "Generated Prompt (Fallback)"`, or `"Could not run
test."` / `"Error: Failed to test prompt. ..."`) rather than an error status.
`api.js` recognizes those sentinels and raises a real error instead of showing
the fallback text as if it were a usable result.

## Authentication

`POST /login` returns a JWT, stored in `chrome.storage.local` and sent as
`Authorization: Bearer <token>`. The token stays in extension storage — it is
never written into a web page's DOM and never reaches `content.js`. Expiry is
checked locally before each authenticated call, and any `401` from an
*authenticated* call clears the stored session and prompts a fresh login (a
`401` from `/login` itself just means the wrong password).

## Settings

**API base URL** defaults to `https://brollysolutions.in/prompt_generator/api`.
To point at a local backend, open the popup, expand **Settings**, and enter
`http://localhost:8000`. Chrome will ask for the matching host permission,
which is declared as optional (not granted by default). Only the production
host and localhost are accepted.

## Testing

See the Phase 2 completion report (in the conversation/PR description) for the
full test breakdown, what was verified in real Chrome via `claude-in-chrome`
versus what is covered by mocked unit tests only, and manual test steps.
