/**
 * Shared API client for the Smart Prompt Generator extension.
 *
 * Used by the background service worker and the popup. Both run on the
 * extension origin and hold host permissions for the API host, so they may call
 * the backend directly. Content scripts must NOT import this module: they run
 * on the page origin and are subject to the page's CORS policy.
 *
 * No AI provider keys and no JWT secret live here. Every AI call goes to the
 * existing FastAPI backend, which owns the Groq/Gemini language routing.
 */

export const DEFAULT_API_BASE = "https://brollysolutions.in/prompt_generator/api";

export const ENHANCE_INSTRUCTION =
  "Improve this into a clear, specific, high-quality AI prompt while preserving the user's original intent.";

// LLM endpoints are slow by design (the backend allows up to 120s upstream).
const LLM_TIMEOUT_MS = 100000;
const FAST_TIMEOUT_MS = 20000;

const STORAGE_KEYS = {
  apiBase: "apiBase",
  session: "session",
  deviceSessionId: "deviceSessionId"
};

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Maps transport/HTTP failures to the user-facing copy required by the spec. */
function messageForStatus(status, detail) {
  switch (status) {
    case 401:
      return "Your session expired. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 429:
      return "Too many requests. Please try again shortly.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Server error. Please try again.";
    default:
      return detail || `Request failed (${status}).`;
  }
}

function normalizeDetail(payload) {
  const detail = payload && payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === "string") return detail[0].msg;
  return "";
}

// ---------------------------------------------------------------- settings

export async function getApiBase() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.apiBase);
  const value = stored[STORAGE_KEYS.apiBase];
  if (typeof value === "string" && value.trim()) return value.trim().replace(/\/+$/, "");
  return DEFAULT_API_BASE;
}

export async function setApiBase(base) {
  const cleaned = String(base || "").trim().replace(/\/+$/, "");
  if (!cleaned) {
    await chrome.storage.local.remove(STORAGE_KEYS.apiBase);
    return DEFAULT_API_BASE;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.apiBase]: cleaned });
  return cleaned;
}

// ------------------------------------------------------------ auth session

/** @returns {Promise<{access_token:string,user_id:number,email:string}|null>} */
export async function getSession() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.session);
  const session = stored[STORAGE_KEYS.session];
  if (!session || typeof session.access_token !== "string") return null;
  if (isTokenExpired(session.access_token)) {
    await clearSession();
    return null;
  }
  return session;
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

/** Local expiry check so we do not spend a request on a token we know is dead. */
function isTokenExpired(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

/** Stable per-install id used as `session_id` for the existing /history API. */
export async function getDeviceSessionId() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.deviceSessionId);
  const existing = stored[STORAGE_KEYS.deviceSessionId];
  if (typeof existing === "string" && existing) return existing;
  const created = `extension-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [STORAGE_KEYS.deviceSessionId]: created });
  return created;
}

// ------------------------------------------------------------- core client

async function request(
  path,
  {
    method = "GET",
    body,
    auth = false,
    authOptional = false,
    timeoutMs = FAST_TIMEOUT_MS,
    unauthorizedMessage = ""
  } = {}
) {
  const base = await getApiBase();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth || authOptional) {
    const session = await getSession();
    if (!session && auth) throw new ApiError("Please log in to continue.", 401);
    // `authOptional` endpoints work signed out, but sending the token lets the
    // backend attribute the result to the user (history, library, analytics).
    if (session) headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", 0);
    }
    throw new ApiError("Unable to connect to Smart Prompt Generator.", 0);
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // Only a rejected *authenticated* call means the stored token is bad. A 401
    // from /login is a wrong password, not an expired session.
    if (response.status === 401 && auth) await clearSession();
    const message =
      response.status === 401 && unauthorizedMessage
        ? unauthorizedMessage
        : messageForStatus(response.status, normalizeDetail(payload));
    throw new ApiError(message, response.status);
  }
  return payload === null ? {} : payload;
}

// ------------------------------------------------------------- API surface

/** POST /login -> { access_token, token_type, user_id, email } */
export async function login(email, password) {
  const data = await request("/login", {
    method: "POST",
    body: { email, password },
    unauthorizedMessage: "Incorrect email or password."
  });
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new ApiError("Login failed: the server returned no access token.", 0);
  }
  const session = {
    access_token: data.access_token,
    user_id: data.user_id,
    email: data.email || email
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
  return session;
}

export async function logout() {
  await clearSession();
}

/** POST /enhance-prompt -> { enhanced_prompt } */
export async function enhancePrompt(prompt, instruction = ENHANCE_INSTRUCTION) {
  const data = await request("/enhance-prompt", {
    method: "POST",
    body: { prompt, instruction },
    timeoutMs: LLM_TIMEOUT_MS
  });
  const enhanced = data.enhanced_prompt;
  if (typeof enhanced !== "string" || !enhanced.trim()) {
    throw new ApiError("The server returned no enhanced prompt.", 0);
  }
  // The backend returns "Error: Failed to enhance prompt..." with a 200 when the
  // upstream model call fails, so surface that as an error instead of a result.
  if (/^Error:\s*Failed to enhance prompt/i.test(enhanced.trim())) {
    throw new ApiError("The enhancement service is unavailable right now. Please try again.", 0);
  }
  return enhanced.trim();
}

/** POST /score-prompt -> { score, criteria, suggestions, rewritten_prompt } */
export async function scorePrompt(prompt) {
  const data = await request("/score-prompt", {
    method: "POST",
    body: { prompt },
    timeoutMs: LLM_TIMEOUT_MS
  });
  const score = Number(data.score);
  if (!Number.isFinite(score)) {
    throw new ApiError("The server returned an unreadable score.", 0);
  }
  const criteria = data.criteria && typeof data.criteria === "object" ? data.criteria : {};
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s) => typeof s === "string" && s.trim())
    : [];
  // When the upstream model call fails the backend still answers 200 with a
  // zeroed-out scorecard. Showing that verbatim would read as a real "0 / 100",
  // so treat an all-zero card as "scoring unavailable" instead.
  const values = Object.values(criteria).map(Number);
  const allZero = values.length > 0 && values.every((v) => v === 0);
  if (score === 0 && allZero) {
    throw new ApiError("Scoring is unavailable right now. Please try again.", 0);
  }
  return {
    score,
    criteria,
    suggestions,
    rewritten_prompt: typeof data.rewritten_prompt === "string" ? data.rewritten_prompt : ""
  };
}

/**
 * POST /generate-questions -> { questions: [{ question, type, options }] }
 *
 * The backend always answers with a usable list (it falls back to three generic
 * questions if the model call fails), so an empty list means something is wrong.
 */
export async function generateQuestions(userInput) {
  const data = await request("/generate-questions", {
    method: "POST",
    body: { user_input: userInput },
    authOptional: true,
    timeoutMs: LLM_TIMEOUT_MS
  });
  const questions = Array.isArray(data.questions) ? data.questions : [];
  return questions
    .filter((q) => q && typeof q.question === "string" && q.question.trim())
    .map((q) => ({
      question: q.question,
      type: typeof q.type === "string" ? q.type : "checkbox",
      options: Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string") : []
    }));
}

// Both gemini_service and groq_service return this exact title when their model
// call fails, alongside a placeholder body that is not a usable prompt.
const GENERATION_FALLBACK_TITLE = "Generated Prompt (Fallback)";

/**
 * POST /generate-final-prompt -> { title, summary, smart_prompt, quality_score,
 * quality_breakdown, quality_feedback, score, rewritten_prompt }
 *
 * Mirrors the web app's request body so both clients hit the same code path.
 */
export async function generateFinalPrompt({
  userInput,
  answers = {},
  questions = [],
  targetAi = "",
  tone = "Auto",
  outputFormat = "Auto",
  length = "Auto",
  role = ""
} = {}) {
  const data = await request("/generate-final-prompt", {
    method: "POST",
    body: {
      user_input: userInput,
      answers,
      questions,
      target_ai: targetAi,
      tone,
      output_format: outputFormat,
      length,
      role
    },
    authOptional: true,
    timeoutMs: LLM_TIMEOUT_MS
  });

  if (data.title === GENERATION_FALLBACK_TITLE) {
    throw new ApiError("Prompt generation is unavailable right now. Please try again.", 0);
  }

  const prompt = data.smart_prompt || data.final_instruction || data.final_prompt || "";
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new ApiError("The server returned an empty prompt.", 0);
  }

  const rawScore = Number(data.quality_score);
  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title : "Generated Prompt",
    summary: typeof data.summary === "string" ? data.summary : "",
    prompt: prompt.trim(),
    score: Number.isFinite(rawScore) ? rawScore : null,
    criteria: data.quality_breakdown && typeof data.quality_breakdown === "object" ? data.quality_breakdown : {},
    feedback: Array.isArray(data.quality_feedback)
      ? data.quality_feedback.filter((f) => typeof f === "string" && f.trim())
      : []
  };
}

/** POST /test-prompt -> { response } */
export async function testPrompt(prompt) {
  const data = await request("/test-prompt", {
    method: "POST",
    body: { prompt },
    authOptional: true,
    timeoutMs: LLM_TIMEOUT_MS
  });
  const text = data.response;
  if (typeof text !== "string" || !text.trim()) {
    throw new ApiError("The server returned an empty test response.", 0);
  }
  // The two services use different failure strings: groq_service returns
  // "Error: Failed to test prompt. ..." and gemini_service returns
  // "Could not run test." Neither is a real answer, so reject both.
  const trimmed = text.trim();
  if (/^Error:\s*Failed to test prompt/i.test(trimmed) || /^Could not run test\.?$/i.test(trimmed)) {
    throw new ApiError("The test service is unavailable right now. Please try again.", 0);
  }
  return trimmed;
}

/** GET /library -> { prompts: [...] } */
export async function getLibrary() {
  const data = await request("/library", { auth: true });
  return Array.isArray(data.prompts) ? data.prompts : [];
}

/**
 * Save an arbitrary prompt to the signed-in user's Library.
 *
 * The backend has no direct "create library entry" endpoint. The web app saves
 * to the Library through POST /history with source "edited (history)", which
 * makes the backend auto-categorize the text and write it to library_prompts.
 * We reuse that exact path rather than adding a duplicate endpoint.
 *
 * The library write is best-effort on the server (it is wrapped in a try/except
 * around an LLM categorization call), so read the library back to confirm the
 * entry actually landed instead of assuming it did.
 */
export async function saveToLibrary(promptText) {
  const sessionId = await getDeviceSessionId();
  await request("/history", {
    method: "POST",
    body: {
      session_id: sessionId,
      prompt_text: promptText,
      source: "edited (history)"
    },
    auth: true,
    timeoutMs: LLM_TIMEOUT_MS
  });

  try {
    const prompts = await getLibrary();
    const match = prompts.find((p) => p && p.prompt_text === promptText);
    if (match) {
      return {
        saved: true,
        name: match.name || "Untitled prompt",
        category: match.category || "General"
      };
    }
  } catch {
    // The confirmation read is advisory; fall through to the softer message.
  }
  return { saved: false, name: "", category: "" };
}
