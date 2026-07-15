"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, Mail, Lock, UserPlus, House, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GoogleLogin } from '@react-oauth/google';
import { API_URL } from "@/lib/api_config";

const PROVIDER_MODELS: Record<string, string[]> = {
  "GroqCloud": ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  "Claude": ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  "OpenAI(chat gpt)": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  "Google Gemini": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  "Cohere Dashboard": ["command-r-plus", "command-r"],
  "Perplexity API": ["llama-3-sonar-large-32k-online", "llama-3-sonar-small-32k-online"],
  "Hugging Face Inference Provider": ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"]
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiProvider, setApiProvider] = useState("");
  const [apiModel, setApiModel] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.access_token, { id: data.user_id, email: data.email });
        setShowApiKeyModal(true);
      } else {
        setError(data.detail || "Google authentication failed");
      }
    } catch (err) {
      setError("Failed to connect to the server for Google signup.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok) {
        login(data.access_token, { id: data.user_id, email: data.email });
        setShowApiKeyModal(true);
      } else {
        setError(data.detail || "Failed to create account");
      }
    } catch (err) {
      console.error("Signup error:", err);
      const error = err as { name?: string };
      if (error.name === 'AbortError') {
        setError("Request timed out. Is the backend running and responding?");
      } else {
        setError("Failed to connect to the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100dvh",
      width: "100%",
      overflowY: "auto",
      overflowX: "hidden",
      background: "#F3F4F4",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
      padding: "16px",
      boxSizing: "border-box",
      position: "relative"
    }}>
      {/* Back to Home Button */}
      <Link 
        href="/" 
        className="absolute top-[16px] left-[16px] md:top-[30px] md:left-[30px] flex items-center gap-[8px] text-[#D4AF37] no-underline font-bold text-[14px] md:text-[15px] z-10"
      >
        <House size={20} />
        Back To Home
      </Link>
      {/* Full Page Background Waves */}
      <div className="bg-wave-container">
        <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
          </defs>
          <g className="parallax">
            <use xlinkHref="#gentle-wave" x="48" y="0" />
            <use xlinkHref="#gentle-wave" x="48" y="3" />
            <use xlinkHref="#gentle-wave" x="48" y="5" />
            <use xlinkHref="#gentle-wave" x="48" y="7" />
          </g>
        </svg>
      </div>

      <div style={{ flex: 1, minHeight: "0px" }}></div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 mx-auto bg-white/80 backdrop-blur-md border border-[#D4AF37]/50 rounded-[24px] py-6 px-5 md:p-10 w-full max-w-[450px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] relative z-10"
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{
            width: "56px", height: "56px",
            background: "#F4CE14",
            borderRadius: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            color: "#000000"
          }}>
            <UserPlus size={32} />
          </div>
          <h1 style={{ color: "#000000", fontSize: "26px", fontWeight: 800, margin: 0 }}>Create Account</h1>
          <p style={{ color: "#4B5563", fontSize: "15px", marginTop: "8px" }}>Join us to generate smarter prompts</p>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            color: "#ef4444",
            padding: "12px",
            borderRadius: "12px",
            fontSize: "14px",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
              <Mail size={18} />
            </div>
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px 12px 48px",
                borderRadius: "14px",
                border: "2px solid #E5E7EB",
                fontSize: "15px",
                outline: "none",
                transition: "border-color 0.2s",
                background: "#ffffff",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#F4CE14"}
              onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            />
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 48px 12px 48px",
                borderRadius: "14px",
                border: "2px solid #E5E7EB",
                fontSize: "15px",
                outline: "none",
                transition: "border-color 0.2s",
                background: "#ffffff",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#F4CE14"}
              onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px"
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
              <Lock size={18} />
            </div>
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 48px 12px 48px",
                borderRadius: "14px",
                border: "2px solid #E5E7EB",
                fontSize: "15px",
                outline: "none",
                transition: "border-color 0.2s",
                background: "#ffffff",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#F4CE14"}
              onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px"
              }}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#F4CE14",
              color: "#000000",
              border: "none",
              borderRadius: "14px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "transform 0.2s, background 0.2s",
              marginTop: "10px"
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
          <span style={{ color: "#9CA3AF", fontSize: "12px", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Login Failed")}
            theme="outline"
            shape="pill"
          />
        </div>

        <p style={{ textAlign: "center", marginTop: "16px", color: "#4B5563", fontSize: "14px" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#D4AF37", fontWeight: 700, textDecoration: "none" }}>
            Sign In
          </Link>
        </p>
      </motion.div>
      <div style={{ flex: 1, minHeight: "0px" }}></div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(255, 255, 255, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          padding: "16px",
          boxSizing: "border-box"
        }}>
        <div style={{ flex: 1, minHeight: "20px" }}></div>
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="shrink-0 mx-auto bg-white border border-[#D4AF37]/30 rounded-[32px] p-6 md:p-12 md:px-10 w-full max-w-[450px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] text-center relative max-h-[90vh] overflow-y-auto"
          >
            <h2 style={{ color: "#000000", fontSize: "32px", fontWeight: 900, margin: "0 0 20px 0", letterSpacing: "-0.02em" }}>
              API Key Setup
            </h2>
            <p style={{ color: "#4B5563", fontSize: "15px", marginBottom: "32px", lineHeight: "1.6", fontWeight: 500 }}>
              Please provide your API key to start generating smart prompts. 
              If you don&apos;t have one, you can use our free shared key to try it out.
            </p>

            <div style={{ position: "relative", marginBottom: "16px" }}>
              <select
                value={apiProvider}
                onChange={(e) => {
                  setApiProvider(e.target.value);
                  setApiModel(""); // Reset model when provider changes
                }}
                style={{
                  width: "100%",
                  padding: "16px 40px 16px 20px",
                  borderRadius: "16px",
                  border: "2px solid #E5E7EB",
                  fontSize: "16px",
                  outline: "none",
                  transition: "all 0.2s",
                  background: "#ffffff",
                  boxSizing: "border-box",
                  textAlign: "center",
                  appearance: "none",
                  cursor: "pointer",
                  color: apiProvider === "" ? "#9CA3AF" : "#000000"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#F4CE14";
                  e.target.style.boxShadow = "0 0 0 4px rgba(244, 206, 20, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E5E7EB";
                  e.target.style.boxShadow = "none";
                }}
              >
                <option value="" disabled hidden>Enter the API Name</option>
                <option value="GroqCloud">GroqCloud</option>
                <option value="Claude">Claude</option>
                <option value="OpenAI(chat gpt)">OpenAI(chat gpt)</option>
                <option value="Google Gemini">Google Gemini</option>
                <option value="Cohere Dashboard">Cohere Dashboard</option>
                <option value="Perplexity API">Perplexity API</option>
                <option value="Hugging Face Inference Provider">Hugging Face Inference Provider</option>
              </select>
              <div style={{
                position: "absolute",
                right: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center"
              }}>
                <ChevronDown size={20} />
              </div>
            </div>

            <div style={{ position: "relative", marginBottom: "16px" }}>
              <select
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                disabled={!apiProvider}
                style={{
                  width: "100%",
                  padding: "16px 40px 16px 20px",
                  borderRadius: "16px",
                  border: "2px solid #E5E7EB",
                  fontSize: "16px",
                  outline: "none",
                  transition: "all 0.2s",
                  background: !apiProvider ? "#F9FAFB" : "#ffffff",
                  boxSizing: "border-box",
                  textAlign: "center",
                  appearance: "none",
                  cursor: !apiProvider ? "not-allowed" : "pointer",
                  color: apiModel === "" ? "#9CA3AF" : "#000000"
                }}
                onFocus={(e) => {
                  if (apiProvider) {
                    e.target.style.borderColor = "#F4CE14";
                    e.target.style.boxShadow = "0 0 0 4px rgba(244, 206, 20, 0.1)";
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E5E7EB";
                  e.target.style.boxShadow = "none";
                }}
              >
                <option value="" disabled hidden>
                  {!apiProvider ? "Select a provider first" : "Enter the Model"}
                </option>
                {apiProvider && PROVIDER_MODELS[apiProvider]?.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <div style={{
                position: "absolute",
                right: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center"
              }}>
                <ChevronDown size={20} />
              </div>
            </div>

            <input
              type="text"
              placeholder="Enter your API Key (optional)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: "16px",
                border: "2px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.2s",
                background: "#ffffff",
                boxSizing: "border-box",
                marginBottom: "24px",
                textAlign: "center"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#F4CE14";
                e.target.style.boxShadow = "0 0 0 4px rgba(244, 206, 20, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.boxShadow = "none";
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <button
                onClick={() => {
                  if (apiKeyInput.trim()) {
                    if (!apiProvider) {
                      alert("Please select an API provider.");
                      return;
                    }
                    if (!apiModel) {
                      alert("Please select a model.");
                      return;
                    }
                    localStorage.setItem("user_api_key", apiKeyInput.trim());
                    localStorage.setItem("user_api_provider", apiProvider);
                    localStorage.setItem("user_api_model", apiModel);
                  } else {
                    localStorage.setItem("user_api_key", "free");
                    localStorage.setItem("user_api_provider", "free");
                    localStorage.setItem("user_api_model", "free");
                  }
                  router.push("/generator");
                }}
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "16px",
                  padding: "18px",
                  fontSize: "16px",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                }}
              >
                Continue
              </button>
              
              <button
                onClick={() => {
                  localStorage.setItem("user_api_key", "free");
                  localStorage.setItem("user_api_provider", "free");
                  localStorage.setItem("user_api_model", "free");
                  router.push("/generator");
                }}
                style={{
                  background: "#ffffff",
                  color: "#4B5563",
                  border: "1px solid #E5E7EB",
                  borderRadius: "16px",
                  padding: "18px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F9FAFB";
                  e.currentTarget.style.color = "#000000";
                  e.currentTarget.style.borderColor = "#D1D5DB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.color = "#4B5563";
                  e.currentTarget.style.borderColor = "#E5E7EB";
                }}
              >
                Use Free API Key
              </button>
            </div>
            
            {/* Spacer to prevent scroll clipping on bottom padding */}
            <div className="h-4 w-full"></div>
          </motion.div>
          <div style={{ flex: 1, minHeight: "20px" }}></div>
        </div>
      )}

      <style>{`
        .bg-wave-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          background: #F3F4F4;
          overflow: hidden;
          pointer-events: none;
        }

        .waves {
          position: absolute;
          bottom: 0;
          width: 100%;
          height: 100vh;
          min-height: 100vh;
        }

        .parallax > use {
          animation: move-forever 25s cubic-bezier(.55,.5,.45,.5)     infinite;
        }
        .parallax > use:nth-child(1) {
          animation-delay: -2s;
          animation-duration: 7s;
          fill: rgba(244, 206, 20, 0.4);
        }
        .parallax > use:nth-child(2) {
          animation-delay: -3s;
          animation-duration: 10s;
          fill: rgba(244, 206, 20, 0.3);
        }
        .parallax > use:nth-child(3) {
          animation-delay: -4s;
          animation-duration: 13s;
          fill: rgba(244, 206, 20, 0.2);
        }
        .parallax > use:nth-child(4) {
          animation-delay: -5s;
          animation-duration: 20s;
          fill: #F3F4F4;
        }
        @keyframes move-forever {
          0% {
           transform: translate3d(-90px,0,0);
          }
          100% { 
            transform: translate3d(85px,0,0);
          }
        }
      `}</style>
    </div>
  );
}
