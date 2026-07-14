"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/ui/Header";
import { useRouter } from "next/navigation";
import { RotateCcw, Edit, Maximize2, X, Trash2, User, Settings, LogOut, Key, Save, Edit2, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
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

type SmartPromptResult = {
  smart_prompt?: string;
  final_instruction?: string;
  final_prompt?: string;
};

interface HistoryItem {
  id: number;
  session_id: string;
  prompt_text: string;
  source: string;
  timestamp: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, token, loading: authLoading, logout } = useAuth();
  const [sessionId, setSessionId] = useState<string>("");
  const [promptHistory, setPromptHistory] = useState<HistoryItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<SmartPromptResult | null>(null);
  
  const [isComparing, setIsComparing] = useState(false);
  const [compareVersion, setCompareVersion] = useState<HistoryItem | null>(null);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);
  const [versionToRestore, setVersionToRestore] = useState<HistoryItem | null>(null);
  const [settingsApiKey, setSettingsApiKey] = useState("");
  const [settingsApiProvider, setSettingsApiProvider] = useState("");
  const [settingsApiModel, setSettingsApiModel] = useState("");
  const [isEditingSettingsKey, setIsEditingSettingsKey] = useState(false);

  const handleOpenSettings = () => {
    setSettingsApiKey(localStorage.getItem("user_api_key") || "");
    setSettingsApiProvider(localStorage.getItem("user_api_provider") || "");
    setSettingsApiModel(localStorage.getItem("user_api_model") || "");
    setIsEditingSettingsKey(false);
    setIsSettingsOpen(true);
  };

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

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchHistory = async (currentSessionId?: string) => {
    const sid = currentSessionId || sessionId;
    if (!sid) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history?session_id=${sid}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      setPromptHistory(data.history || []);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      let sId = localStorage.getItem("sessionId");
      if (!sId) {
        sId = "session_" + Date.now();
        localStorage.setItem("sessionId", sId);
      }
      setSessionId(sId);
      
      const savedPrompt = localStorage.getItem("finalPrompt");
      
      if (savedPrompt) {
        setCurrentPrompt(JSON.parse(savedPrompt));
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId && token) {
      const timer = window.setTimeout(() => {
        void fetchHistory(sessionId);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  const handleSaveEdit = async (versionId: number) => {
    try {
      setIsSavingEdit(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          prompt_text: editBuffer,
          source: "edited (history)",
        }),
      });
      if (response.ok) {
        setEditingId(null);
        await fetchHistory();
      } else {
        alert("Failed to save changes.");
      }
    } catch (error) {
      console.error(error);
      alert("Error saving changes.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = (versionId: number) => {
    setVersionToDelete(versionId);
  };

  const confirmDelete = async () => {
    if (versionToDelete === null) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history/${versionToDelete}`, {
        method: "DELETE",
        headers: token ? { "Authorization": `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        await fetchHistory();
      } else {
        alert("Failed to delete version.");
      }
    } catch (error) {
      console.error(error);
      alert("Error deleting version.");
    } finally {
      setVersionToDelete(null);
    }
  };

  const handleRestore = (version: HistoryItem) => {
    setVersionToRestore(version);
  };

  const confirmRestore = async () => {
    if (!versionToRestore) return;
    try {
      let promptToRestore = versionToRestore.prompt_text;
      
      const index = promptHistory.findIndex(v => v.id === versionToRestore.id);
      const prevVersion = promptHistory[index + 1];
      if (prevVersion) {
        promptToRestore = prevVersion.prompt_text;
      }

      // Create a new version for the restore action
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          prompt_text: promptToRestore,
          source: "restored",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create history entry for restore");
      }

      const updatedPrompt = {
        smart_prompt: promptToRestore
      };
      localStorage.setItem("finalPrompt", JSON.stringify(updatedPrompt));
      setCurrentPrompt(updatedPrompt);
      await fetchHistory();
      setVersionToRestore(null);
    } catch (error) {
      console.error(error);
      setVersionToRestore(null);
    }
  };

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", background: "#F3F4F4" }}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F3F4F4",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0",
      color: "#000000",
    }}>
      {/* Header */}
      <Header onOpenSettings={handleOpenSettings} />

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
        <div className="max-w-[900px] mx-auto px-4 py-8 md:px-6 md:py-12 md:pb-20">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px", textAlign: "center" }}>
            <div style={{
              width: "60px", height: "60px",
              background: "#D4AF37",
              borderRadius: "18px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "30px", marginBottom: "20px",
              color: "#000000"
            }}>📜</div>
            <h1 style={{ color: "#000000", fontSize: "42px", fontWeight: 800, margin: 0, letterSpacing: "-1.5px" }}>
              Version History
            </h1>
            <p style={{ color: "#374151", fontSize: "18px", margin: "10px 0 0", maxWidth: "600px", fontWeight: 500 }}>
              View, compare, and restore your previous prompt versions.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {promptHistory.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "60px",
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(212, 175, 55, 0.5)",
                borderRadius: "24px",
                color: "#64748b"
              }}>
                No history found for this session.
              </div>
            ) : (
              promptHistory.map((version) => (
                <div key={version.id} style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(212, 175, 55, 0.5)",
                  borderRadius: "24px",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
                }}>
                  <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        background: version.source.includes('generated') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(212, 175, 55, 0.1)',
                        color: version.source.includes('generated') ? '#10b981' : '#AA8A27',
                        padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: "0.5px"
                      }}>
                        {version.source}
                      </span>
                    </div>
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      {editingId === version.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(version.id)}
                            disabled={isSavingEdit}
                            style={{
                              background: "#000000",
                              border: "none", borderRadius: "10px",
                              padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: isSavingEdit ? "not-allowed" : "pointer",
                              opacity: isSavingEdit ? 0.7 : 1,
                            }}
                          >
                            {isSavingEdit ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              background: "#f3f4f6",
                              border: "1px solid #e5e7eb", borderRadius: "10px",
                              padding: "6px 14px", color: "#4b5563", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(version.id);
                              setEditBuffer(version.prompt_text);
                            }}
                            style={{
                              background: "rgba(255, 255, 255, 0.8)",
                              border: "1px solid #D4AF37",
                              borderRadius: "10px",
                              padding: "6px 14px", color: "#AA8A27", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: "4px"
                            }}
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={() => {
                              setIsComparing(true);
                              setCompareVersion(version);
                            }}
                            style={{
                              background: "rgba(255, 255, 255, 0.8)",
                              border: "1px solid #D4AF37",
                              borderRadius: "10px",
                              padding: "6px 14px", color: "#000000", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: "4px"
                            }}
                          >
                            <Maximize2 size={14} /> Compare
                          </button>
                          {!version.source.includes('generated') && !version.source.includes('restored') && (
                            <button
                              onClick={() => handleRestore(version)}
                              style={{
                                background: "#000000",
                                border: "none",
                                borderRadius: "10px",
                                padding: "6px 14px", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <RotateCcw size={14} /> Restore
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(version.id)}
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid #ef4444",
                              borderRadius: "10px",
                              padding: "6px 14px", color: "#ef4444", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: "4px"
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === version.id ? (
                    <textarea
                      value={editBuffer}
                      onChange={(e) => setEditBuffer(e.target.value)}
                      style={{
                        width: "100%", height: "200px",
                        background: "rgba(249, 250, 251, 0.8)",
                        border: "1px solid #D4AF37",
                        borderRadius: "16px",
                        padding: "16px",
                        color: "#000000",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        fontFamily: "inherit",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  ) : (
                    <div style={{
                      background: "rgba(249, 250, 251, 0.6)",
                      border: "1px solid rgba(212, 175, 55, 0.2)",
                      borderRadius: "16px",
                      padding: "20px",
                      color: "#1f2937",
                      fontSize: "14px",
                      lineHeight: "1.7",
                      whiteSpace: "pre-wrap",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}>
                      {version.prompt_text}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Comparison Modal */}
      {isComparing && compareVersion && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-white/95 backdrop-blur-md z-[1000] flex flex-col p-4 md:p-10 box-border overflow-y-auto">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexShrink: 0 }}>
            <h2 style={{ color: "#000000", margin: 0, fontWeight: 800 }}>Version Comparison</h2>
            <button
              onClick={() => setIsComparing(false)}
              style={{
                background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "50%",
                width: "40px", height: "40px", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                flexShrink: 0
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 flex-1 md:min-h-0">
            <div className="flex flex-col min-h-[300px] md:min-h-0">
              <div style={{ color: "#AA8A27", marginBottom: "12px", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>Current Draft</div>
              <div style={{
                flex: 1, background: "rgba(249, 250, 251, 0.8)", border: "2px solid #D4AF37",
                borderRadius: "20px", padding: "20px md:24px", overflowY: "auto", color: "#000000",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }} className="p-5 md:p-6">
                {compareVersion.prompt_text}
              </div>
            </div>
            <div className="flex flex-col min-h-[300px] md:min-h-0 pb-6 md:pb-0">
              <div style={{ color: "#AA8A27", marginBottom: "12px", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>
                Historical Version
              </div>
              <div style={{
                flex: 1, background: "rgba(249, 250, 251, 0.8)", border: "2px solid #D4AF37",
                borderRadius: "20px", overflowY: "auto", color: "#000000",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }} className="p-5 md:p-6">
                {(() => {
                  const index = promptHistory.findIndex(v => v.id === compareVersion.id);
                  const prevVersion = promptHistory[index + 1];
                  return prevVersion ? prevVersion.prompt_text : compareVersion.prompt_text;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {versionToDelete !== null && (
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
              style={{
                background: "#ffffff",
                border: "1px solid rgba(212, 175, 55, 0.3)",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "400px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                textAlign: "center"
              }}
              className="p-6 md:p-8"
            >
              <div style={{
                width: "48px", height: "48px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "12px",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                color: "#ef4444"
              }}>
                <Trash2 size={24} />
              </div>
              <h2 style={{ color: "#000000", fontSize: "20px", fontWeight: 800, margin: "0 0 8px 0" }}>Delete Version?</h2>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: "0 0 24px 0", lineHeight: 1.5 }}>
                Are you sure you want to delete this prompt version? This action cannot be undone.
              </p>
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setVersionToDelete(null)}
                  style={{
                    flex: 1,
                    background: "#f3f4f6",
                    color: "#4b5563",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#E5E7EB"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    flex: 1,
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Restore Confirmation Modal */}
      <AnimatePresence>
        {versionToRestore !== null && (
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
              style={{
                background: "#ffffff",
                border: "1px solid rgba(212, 175, 55, 0.3)",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "400px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                textAlign: "center"
              }}
              className="p-6 md:p-8"
            >
              <div style={{
                width: "48px", height: "48px",
                background: "rgba(212, 175, 55, 0.1)",
                borderRadius: "12px",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                color: "#AA8A27"
              }}>
                <RotateCcw size={24} />
              </div>
              <h2 style={{ color: "#000000", fontSize: "20px", fontWeight: 800, margin: "0 0 8px 0" }}>Restore Version?</h2>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: "0 0 24px 0", lineHeight: 1.5 }}>
                Are you sure you want to restore this prompt version? It will become your active prompt.
              </p>
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setVersionToRestore(null)}
                  style={{
                    flex: 1,
                    background: "#f3f4f6",
                    color: "#4b5563",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#E5E7EB"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  style={{
                    flex: 1,
                    background: "#000000",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Restore
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
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
        button:hover { opacity: 0.92; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}

