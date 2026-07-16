// Resolves the backend API base URL at runtime so a single build/.env works in
// both local development and production.
// - When the page is served from localhost/127.0.0.1, target the local backend.
// - Otherwise use NEXT_PUBLIC_API_URL, falling back to the production host.
// Because NEXT_PUBLIC_* is inlined at build time, this must be evaluated at
// call time (inside fetch handlers) rather than captured once at module load.
export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_API_URL_LOCAL || "http://localhost:8000";
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://brollysolutions.in/prompt_generator/api";

  // Debug log to help troubleshoot in production console (once)
  if (typeof window !== "undefined") {
    const win = window as unknown as { _api_logged?: boolean };
    if (!win._api_logged) {
      console.log("🚀 Smart Prompt Generator API initialized with:", baseUrl);
      win._api_logged = true;
    }
  }

  return baseUrl;
};

export const API_URL = getApiUrl();
