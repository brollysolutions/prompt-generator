"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/ui/Header";
import { Copy, User, Settings, LogOut, Key, Save, Edit2, X, ChevronDown, Globe, Share } from "lucide-react";

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
import ShareDialog from "@/components/ui/ShareDialog";

type LibraryPrompt = {
  id: number;
  name: string;
  prompt_text: string;
  tags: string[];
  category: string;
  created_at: string;
  is_published?: boolean;
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
  const [publishedIds, setPublishedIds] = useState<Record<number, boolean>>({});
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [publishModalPrompt, setPublishModalPrompt] = useState<LibraryPrompt | null>(null);
  const [publishMessage, setPublishMessage] = useState<{ text: string, isError: boolean } | null>(null);
  const [shareModalPrompt, setShareModalPrompt] = useState<LibraryPrompt | null>(null);

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/library?user_id=${user.id}`);
    
    const data = await response.json();
    setPrompts(data.prompts || []);
    
    // Initialize published state from backend
    const publishedState: Record<number, boolean> = {};
    (data.prompts || []).forEach((p: any) => {
      if (p.is_published) {
        publishedState[p.id] = true;
      }
    });
    setPublishedIds(publishedState);
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

  const handlePublish = async () => {
    if (!user || !publishModalPrompt) return;
    try {
      setPublishingId(publishModalPrompt.id);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          library_prompt_id: publishModalPrompt.id,
          user_id: user.id,
          email: user.email
        })
      });
      const data = await response.json();
      if (response.ok) {
        setPublishedIds(prev => ({ ...prev, [publishModalPrompt.id]: true }));
        setPublishMessage({ text: data.already_published ? "This prompt is already in the community library!" : "Prompt published to the community library successfully!", isError: false });
      } else {
        setPublishMessage({ text: "Failed to publish prompt to community: " + (data.detail || "Unknown error"), isError: true });
      }
    } catch (error) {
      console.error("Failed to publish to community", error);
      setPublishMessage({ text: "Error publishing prompt.", isError: true });
    } finally {
      setPublishingId(null);
    }
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
          <Header onOpenSettings={() => setIsSettingsOpen(true)} />

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
            <div className="max-w-[1200px] mx-auto px-4 py-8 md:px-6 md:py-12 md:pb-20">
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
                      <div className="flex flex-row items-start justify-between gap-2 w-full">
                        <span style={{
                          background: "rgba(212, 175, 55, 0.15)",
                          color: "#AA8A27",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          lineHeight: 1.2,
                          display: "inline-block",
                          wordBreak: "break-word"
                        }}>
                          {p.category}
                        </span>
                        <div className="flex flex-row items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setPublishModalPrompt(p);
                              setPublishMessage(null);
                            }}
                            disabled={publishedIds[p.id] || publishingId === p.id}
                            style={{
                              background: publishedIds[p.id] ? "#10b981" : "#3b82f6",
                              border: "none",
                              borderRadius: "8px",
                              padding: "4px 10px",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: (publishedIds[p.id] || publishingId === p.id) ? "default" : "pointer",
                              transition: "all 0.2s ease",
                              opacity: publishingId === p.id ? 0.7 : 1
                            }}
                          >
                            {publishingId === p.id ? "Publishing..." : publishedIds[p.id] ? "Published" : "Publish"}
                          </button>
                          <button
                            onClick={() => setShareModalPrompt(p)}
                            style={{
                              background: "#f59e0b",
                              border: "none",
                              borderRadius: "8px",
                              padding: "4px 10px",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Share size={12} /> Share
                          </button>
                          <button
                            onClick={() => handleCopy(p.prompt_text, p.id)}
                            style={{
                              background: copiedId === p.id ? "#10b981" : "#000000",
                              border: "none",
                              borderRadius: "8px",
                              padding: "4px 10px",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {copiedId === p.id ? "Copied!" : "Copy"}
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
                        {Array.isArray(p.tags) ? p.tags.map((tag: any, idx: number) => (
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
                        )) : null}
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
            ::-webkit-scrollbar { width: 8px; height: 0px; }
            ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
            .scrollbar-hide::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
            .scrollbar-hide { -ms-overflow-style: none !important; scrollbar-width: none !important; }
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
                padding: "16px",
                boxSizing: "border-box"
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white border border-[#D4AF37]/30 rounded-[24px] p-6 md:p-8 w-full max-w-[450px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] relative"
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
                        {settingsApiProvider && PROVIDER_MODELS[settingsApiProvider]?.map(m => (
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

          {/* Publish Modal */}
          <AnimatePresence>
            {publishModalPrompt && (
              <div style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)",
                zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", boxSizing: "border-box"
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  style={{
                    background: "#ffffff", border: "1px solid rgba(212, 175, 55, 0.3)",
                    borderRadius: "24px", width: "100%", maxWidth: "400px",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.1)", position: "relative",
                    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
                  }}
                  className="p-6 md:p-8"
                >
                  <button
                    onClick={() => {
                      setPublishModalPrompt(null);
                      setPublishMessage(null);
                    }}
                    style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
                  >
                    <X size={20} />
                  </button>
                  
                  <div style={{
                    width: "48px", height: "48px", background: "rgba(59, 130, 246, 0.1)",
                    borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px", color: "#3b82f6"
                  }}>
                    <Globe size={24} />
                  </div>
                  
                  <h2 style={{ color: "#000000", fontSize: "20px", fontWeight: 800, margin: "0 0 8px 0" }}>Publish to Community?</h2>
                  
                  {publishMessage ? (
                    <div style={{
                      background: publishMessage.isError ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      color: publishMessage.isError ? "#ef4444" : "#10b981",
                      padding: "16px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, margin: "16px 0", width: "100%"
                    }}>
                      {publishMessage.text}
                    </div>
                  ) : (
                    <p style={{ color: "#6B7280", fontSize: "14px", margin: "0 0 24px 0", lineHeight: 1.5 }}>
                      Are you sure you want to make the prompt <strong>"{publishModalPrompt.name}"</strong> visible to everyone? This action cannot be undone.
                    </p>
                  )}
                  
                  <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: publishMessage ? "16px" : "0" }}>
                    {publishMessage ? (
                      <button onClick={() => { setPublishModalPrompt(null); setPublishMessage(null); }} style={{
                        flex: 1, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", color: "#4b5563", fontSize: "14px", fontWeight: 600, cursor: "pointer"
                      }}>Close</button>
                    ) : (
                      <>
                        <button onClick={() => { setPublishModalPrompt(null); setPublishMessage(null); }} style={{
                          flex: 1, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", color: "#4b5563", fontSize: "14px", fontWeight: 600, cursor: "pointer"
                        }}>Cancel</button>
                        <button onClick={handlePublish} disabled={publishingId !== null} style={{
                          flex: 1, background: "#3b82f6", border: "none", borderRadius: "12px", padding: "12px", color: "#ffffff", fontSize: "14px", fontWeight: 600, cursor: publishingId !== null ? "default" : "pointer", opacity: publishingId !== null ? 0.7 : 1
                        }}>{publishingId !== null ? "Publishing..." : "Make Publish"}</button>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Share Dialog */}
          <ShareDialog
            isOpen={!!shareModalPrompt}
            onClose={() => setShareModalPrompt(null)}
            promptText={shareModalPrompt?.prompt_text || ""}
            qualityScore={0} // We don't have the exact score in library, send 0 to hide it
            category={shareModalPrompt?.category || ""}
            language={"en"} // Default
            token={typeof window !== "undefined" ? localStorage.getItem("auth_token") : null}
          />
        </>
      )}
    </div>
  );
}
