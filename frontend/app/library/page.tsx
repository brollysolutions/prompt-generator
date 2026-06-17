"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, User, Settings, LogOut, Key, Save, Edit2, X, ChevronDown } from "lucide-react";

const PROVIDER_MODELS: Record<string, string[]> = {
  "GroqCloud": ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  "Claude": ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  "OpenAI(chat gpt)": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  "Google Gemini": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  "Cohere Dashboard": ["command-r-plus", "command-r"],
  "Perplexity API": ["llama-3-sonar-large-32k-online", "llama-3-sonar-small-32k-online"],
  "Hugging Face Inference Provider": ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"]
};
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

type LibraryPrompt = {
  id: number;
  name: string;
  prompt_text: string;
  tags: string[];
  category: string;
  created_at: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsApiKey, setSettingsApiKey] = useState("");
  const [settingsApiProvider, setSettingsApiProvider] = useState("");
  const [settingsApiModel, setSettingsApiModel] = useState("");
  const [isEditingSettingsKey, setIsEditingSettingsKey] = useState(false);
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);

  // Load configuration for settings
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsApiKey(localStorage.getItem("user_api_key") || "");
      setSettingsApiProvider(localStorage.getItem("user_api_provider") || "");
      setSettingsApiModel(localStorage.getItem("user_api_model") || "");
      setIsEditingSettingsKey(false);
    }
  }, [isSettingsOpen]);

  const handleSaveSettingsKey = () => {
    const trimmedKey = settingsApiKey.trim();
    if (trimmedKey && trimmedKey !== "free") {
      if (!settingsApiProvider) {
        alert("Please select an API provider.");
        return;
      }
      if (!settingsApiModel) {
        alert("Please select a model.");
        return;
      }
      localStorage.setItem("user_api_key", trimmedKey);
      localStorage.setItem("user_api_provider", settingsApiProvider);
      localStorage.setItem("user_api_model", settingsApiModel);
    } else {
      localStorage.setItem("user_api_key", "free");
      localStorage.setItem("user_api_provider", "free");
      localStorage.setItem("user_api_model", "free");
    }
    setIsEditingSettingsKey(false);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);
const fetchLibrary = async () => {
  if (!user) return;
  try {
    const response = await fetch(`http://127.0.0.1:8000/library?user_id=${user.id}`);
    const data = await response.json();
    setPrompts(data.prompts || []);
  } catch (error) {
    console.error("Failed to fetch library", error);
  }
};

useEffect(() => {
  if (!authLoading && user) {
    fetchLibrary();
  }
}, [user, authLoading]);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPrompts = prompts.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.prompt_text.toLowerCase().includes(query) ||
      p.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F3F4F4",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0",
      color: "#000000",
    }}>
      {authLoading ? (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>Loading...</div>
      ) : !user ? null : (
        <>
          {/* Header */}
          <nav style={{
            background: "#ffffff",
            borderBottom: "1px solid #D4AF37",
            padding: "16px 24px",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
          }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Link 
                  href="/generator"
                  style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#000000",
                  borderRadius: "10px",
                  textDecoration: "none"
                  }}
                >
                  Generator
                </Link>
                <Link 
                  href="/history"
                  style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#000000",
                  borderRadius: "10px",
                  textDecoration: "none"
                  }}
                >
                  History
                </Link>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px",
                      background: "rgba(212, 175, 55, 0.1)",
                      border: "1px solid #D4AF37",
                      borderRadius: "50%",
                      cursor: "pointer",
                      color: "#AA8A27"
                    }}
                  >
                    <User size={18} />
                  </button>
                  {isProfileOpen && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "8px",
                      background: "#fff",
                      border: "1px solid #eaeaea",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      minWidth: "120px",
                      zIndex: 101
                    }}>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          setIsSettingsOpen(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#333",
                          textAlign: "left",
                          borderBottom: "1px solid #eaeaea"
                        }}
                      >
                        <Settings size={16} /> Settings
                      </button>
                      <button
                        onClick={logout}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#e11d48",
                          textAlign: "left"
                        }}
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </nav>

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

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "50px 24px 80px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "60px", textAlign: "center" }}>
                <div style={{
                  width: "60px", height: "60px",
                  background: "#D4AF37",
                  borderRadius: "18px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "30px", marginBottom: "20px",
                  color: "#000000"
                }}>📚</div>
                <h1 style={{ color: "#000000", fontSize: "42px", fontWeight: 800, margin: 0, letterSpacing: "-1.5px" }}>
                  Personal Prompt Library
                </h1>
                <p style={{ color: "#374151", fontSize: "18px", margin: "10px 0 30px", maxWidth: "600px", fontWeight: 500 }}>
                  Your personal collection of AI-optimized prompts, automatically categorized and searchable.
                </p>
                
                {/* Search Bar */}
                <div style={{ position: "relative", width: "100%", maxWidth: "600px" }}>
                  <input
                    type="text"
                    placeholder="Search by name, category, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "18px 24px 18px 56px",
                      background: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                      border: "2px solid #D4AF37",
                      borderRadius: "20px",
                      color: "#000000",
                      fontSize: "16px",
                      outline: "none",
                      transition: "all 0.3s ease",
                      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
                    }}
                  />
                  <div style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px", opacity: 0.5 }}>🔍</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
                {filteredPrompts.length === 0 ? (
                  <div style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "80px",
                    background: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px dashed #D4AF37",
                    borderRadius: "32px",
                    color: "#64748b"
                  }}>
                    {searchQuery ? "No prompts match your search." : "Your library is empty. Generate a prompt to see it here!"}
                  </div>
                ) : (
                  filteredPrompts.map((p) => (
                    <div key={p.id} style={{
                      background: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(212, 175, 55, 0.5)",
                      borderRadius: "28px",
                      padding: "28px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                      transition: "transform 0.2s ease, background 0.2s ease",
                      cursor: "default",
                      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.85)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.7)";
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <span style={{
                          background: "rgba(212, 175, 55, 0.15)",
                          color: "#AA8A27",
                          padding: "4px 12px",
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px"
                        }}>
                          {p.category}
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleCopy(p.prompt_text, p.id)}
                            style={{
                              background: copiedId === p.id ? "#10b981" : "#000000",
                              border: "none",
                              borderRadius: "10px",
                              padding: "6px 12px",
                              color: "#fff",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {copiedId === p.id ? "Copied!" : "Copy Prompt"}
                          </button>
                        </div>
                      </div>
                      
                      <h3 style={{ color: "#000000", fontSize: "20px", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                        {p.name}
                      </h3>
                      
                      <div style={{
                        background: "rgba(249, 250, 251, 0.6)",
                        borderRadius: "16px",
                        padding: "16px",
                        color: "#1f2937",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        height: "120px",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: "vertical",
                        position: "relative",
                      }}>
                        {p.prompt_text}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, width: "100%", height: "40px",
                          background: "linear-gradient(to top, rgba(249, 250, 251, 0.8), transparent)"
                        }}></div>
                      </div>
                      
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {p.tags.map((tag, idx) => (
                          <span key={idx} style={{
                            color: "#4b5563",
                            fontSize: "12px",
                            background: "rgba(243, 244, 246, 0.8)",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            border: "1px solid rgba(212, 175, 55, 0.2)"
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
            body { background: #F3F3F3 !important; overflow-x: hidden; }

            .bg-wave-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 0;
              background: #F3F3F3;
              overflow: hidden;
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
              fill: rgba(255, 201, 0, 0.4);
            }
            .parallax > use:nth-child(2) {
              animation-delay: -3s;
              animation-duration: 10s;
              fill: rgba(255, 225, 0, 0.3);
            }
            .parallax > use:nth-child(3) {
              animation-delay: -4s;
              animation-duration: 13s;
              fill: rgba(254, 186, 23, 0.2);
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

          {/* Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <div style={{
                position: "fixed",
                top: 0, left: 0, width: "100%", height: "100%",
                background: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px"
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                    borderRadius: "24px",
                    padding: "32px",
                    width: "100%",
                    maxWidth: "450px",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                    position: "relative"
                  }}
                >
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9CA3AF"
                    }}
                  >
                    <X size={20} />
                  </button>

                  <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{
                      width: "48px", height: "48px",
                      background: "rgba(212, 175, 55, 0.1)",
                      borderRadius: "12px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 16px",
                      color: "#AA8A27"
                    }}>
                      <Key size={24} />
                    </div>
                    <h2 style={{ color: "#000000", fontSize: "24px", fontWeight: 800, margin: 0 }}>Settings</h2>
                    <p style={{ color: "#6B7280", fontSize: "14px", marginTop: "4px" }}>Manage your account preferences</p>
                  </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                color: "#374151",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px"
              }}>
                API Configuration
              </label>
              
              <div style={{
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {isEditingSettingsKey ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ position: "relative" }}>
                      <select
                        value={settingsApiProvider}
                        onChange={(e) => {
                          setSettingsApiProvider(e.target.value);
                          setSettingsApiModel("");
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 32px 10px 12px",
                          borderRadius: "8px",
                          border: "2px solid #D4AF37",
                          fontSize: "14px",
                          outline: "none",
                          appearance: "none",
                          background: "#ffffff",
                          color: settingsApiProvider === "" ? "#9CA3AF" : "#000000"
                        }}
                      >
                        <option value="" disabled hidden>Enter the API Name</option>
                        {Object.keys(PROVIDER_MODELS).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }} />
                    </div>

                    <div style={{ position: "relative" }}>
                      <select
                        value={settingsApiModel}
                        onChange={(e) => setSettingsApiModel(e.target.value)}
                        disabled={!settingsApiProvider}
                        style={{
                          width: "100%",
                          padding: "10px 32px 10px 12px",
                          borderRadius: "8px",
                          border: "2px solid #D4AF37",
                          fontSize: "14px",
                          outline: "none",
                          appearance: "none",
                          background: !settingsApiProvider ? "#F3F4F6" : "#ffffff",
                          color: settingsApiModel === "" ? "#9CA3AF" : "#000000"
                        }}
                      >
                        <option value="" disabled hidden>
                          {!settingsApiProvider ? "Select a provider first" : "Enter the Model"}
                        </option>
                        {settingsApiProvider && PROVIDER_MODELS[settingsApiProvider] && PROVIDER_MODELS[settingsApiProvider].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }} />
                    </div>

                    <input
                      type="text"
                      value={settingsApiKey}
                      onChange={(e) => setSettingsApiKey(e.target.value)}
                      placeholder="Enter API Key (or leave empty for 'free')"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "2px solid #D4AF37",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                        color: "#000"
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={handleSaveSettingsKey}
                        style={{
                          flex: 1,
                          background: "#000000",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingSettingsKey(false);
                          setSettingsApiKey(localStorage.getItem("user_api_key") || "");
                          setSettingsApiProvider(localStorage.getItem("user_api_provider") || "");
                          setSettingsApiModel(localStorage.getItem("user_api_model") || "");
                        }}
                        style={{
                          flex: 1,
                          background: "#ffffff",
                          color: "#4B5563",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", fontWeight: 700 }}>Provider</div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                          {localStorage.getItem("user_api_provider") === "free" ? "Free Shared" : localStorage.getItem("user_api_provider") || "Not Set"}
                        </div>
                      </div>
                      <button
                        onClick={() => setIsEditingSettingsKey(true)}
                        style={{
                          background: "rgba(212, 175, 55, 0.1)",
                          color: "#AA8A27",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                    </div>

                    <div>
                      <div style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", fontWeight: 700 }}>Model</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                        {localStorage.getItem("user_api_model") === "free" ? "Free Shared" : localStorage.getItem("user_api_model") || "Not Set"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", fontWeight: 700 }}>API Key</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827", fontFamily: "monospace" }}>
                        {localStorage.getItem("user_api_key") === "free" ? "Free Shared Key" : localStorage.getItem("user_api_key") ? "••••••••" + (localStorage.getItem("user_api_key") || "").slice(-4) : "Not Set"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    style={{
                      width: "100%",
                      background: "#F3F4F6",
                      color: "#4B5563",
                      border: "none",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#E5E7EB"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#F3F4F6"}
                  >
                    Close
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
