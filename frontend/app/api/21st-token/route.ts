import { createTokenHandler } from "@21st-sdk/nextjs/server";

// This route securely exchanges your API Key for a temporary JWT token
// to keep your credentials safe while the frontend communicates with 21st.dev agents.
export const POST = createTokenHandler({
  apiKey: process.env.API_KEY_21ST || "",
});
