export const getApiUrl = () => {
  // Use environment variable if available, otherwise fallback to the hardcoded production URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://brollysolutions.in/prompt_generator/api";
  
  // Debug log to help troubleshoot in production console
  if (typeof window !== "undefined") {
    // Only log once to avoid clutter
    const win = window as unknown as { _api_logged?: boolean };
    if (!win._api_logged) {
      console.log("🚀 Smart Prompt Generator API initialized with:", baseUrl);
      win._api_logged = true;
    }
  }
  
  return baseUrl;
};

export const API_URL = getApiUrl();
