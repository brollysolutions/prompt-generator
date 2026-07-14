"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/ui/Header";
import { Copy, User, Settings, LogOut, Key, Save, Edit2, X, ChevronDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

const PROVIDER_MODELS: Record<string, string[]> = {
  "GroqCloud": ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  "Claude": ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  "OpenAI(chat gpt)": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  "Google Gemini": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  "Cohere Dashboard": ["command-r-plus", "command-r"],
  "Perplexity API": ["llama-3-sonar-large-32k-online", "llama-3-sonar-small-32k-online"],
  "Hugging Face Inference Provider": ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"]
};

type CommunityPrompt = {
  id: number;
  name: string;
  prompt_text: string;
  tags: string[];
  category: string;
  author_email: string;
  upvotes: number;
  created_at: string;
  has_upvoted: boolean;
};

export default function CommunityPage() {
  const router = useRouter();
  const { user, token, loading: authLoading, logout } = useAuth();
  
  // Navigation / Profile states
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  
  // Community Data states
  const [prompts, setPrompts] = useState<CommunityPrompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("trending");
  const [loading, setLoading] = useState(true);
  
  // Interaction states
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchCommunity = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community?sort_by=${sortBy}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error("Failed to fetch community", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      const timer = window.setTimeout(() => {
        void fetchCommunity();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user, authLoading, sortBy]);

  const handleUpvote = async (promptId: number) => {
    if (!user) return;
    
    // Optimistic UI update
    setPrompts(prev => prev.map(p => {
      if (p.id === promptId) {
        return {
          ...p,
          has_upvoted: !p.has_upvoted,
          upvotes: p.has_upvoted ? p.upvotes - 1 : p.upvotes + 1
        };
      }
      return p;
    }));

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community/upvote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt_id: promptId })
      });
      // Optionally refetch or trust the optimistic update
    } catch (error) {
      console.error("Failed to upvote", error);
      // Revert on error could be implemented here
    }
  };

  const handleSave = async (promptId: number) => {
    if (!user) return;
    try {
      setSavingIds(prev => ({ ...prev, [promptId]: true }));
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt_id: promptId })
      });
      
      if (response.ok) {
        setSavedIds(prev => ({ ...prev, [promptId]: true }));
      } else {
        alert("Failed to save to library");
      }
    } catch (error) {
      console.error("Failed to save prompt", error);
    } finally {
      setSavingIds(prev => ({ ...prev, [promptId]: false }));
    }
  };

  const handleRemix = (promptText: string) => {
    // Navigate to generator with the prompt text ready to be remixed
    // The generator would need to accept a query param or read from sessionStorage
    sessionStorage.setItem("remix_prompt", promptText);
    router.push("/generator");
  };

  const handleReport = async (promptId: number) => {
    if (window.confirm("Are you sure you want to report this prompt for inappropriate content?")) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community/report/${promptId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user?.id })
        });
        alert("Prompt reported successfully. An admin will review it.");
      } catch (error) {
        console.error("Failed to report", error);
      }
    }
  };

  // Derive unique categories from prompts for the filter dropdown
  const categories = ["All", ...Array.from(new Set(prompts.map(p => p.category)))];

  const filteredPrompts = prompts.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(query) ||
      p.prompt_text.toLowerCase().includes(query) ||
      p.tags.some((t) => t.toLowerCase().includes(query)) ||
      p.author_email.toLowerCase().includes(query);
      
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
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
          <Header onOpenSettings={handleOpenSettings} />

          {/* Full Page Background Waves */}
          <div className="bg-wave-container">
            <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
              <defs><path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" /></defs>
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
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px", textAlign: "center" }}>
                <div style={{
                  width: "60px", height: "60px", background: "#D4AF37", borderRadius: "18px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", marginBottom: "20px"
                }}>🌍</div>
                <h1 style={{ color: "#000000", fontSize: "42px", fontWeight: 800, margin: 0, letterSpacing: "-1.5px" }}>
                  Community Prompts
                </h1>
                <p style={{ color: "#374151", fontSize: "18px", margin: "10px 0 30px", maxWidth: "600px", fontWeight: 500 }}>
                  Browse, save, and remix prompts shared by everyone.
                </p>
                
                {/* Controls Row */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[800px] justify-center items-stretch">
                  {/* Search Bar */}
                  <div className="relative w-full sm:flex-[2]">
                    <input
                      type="text"
                      placeholder="Search prompts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%", padding: "14px 20px 14px 48px", background: "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(12px)", border: "2px solid #D4AF37", borderRadius: "14px",
                        color: "#000000", fontSize: "15px", outline: "none"
                      }}
                    />
                    <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", opacity: 0.5 }}>🔍</div>
                  </div>

                    {/* Category Dropdown */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full sm:flex-[1]"
                      style={{
                        padding: "14px 20px", background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(12px)",
                        border: "2px solid #E5E7EB", borderRadius: "14px", color: "#000000", fontSize: "16px", outline: "none",
                        cursor: "pointer", fontWeight: 500, fontFamily: "inherit", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"
                      }}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Sort Dropdown */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full sm:flex-[1]"
                      style={{
                        padding: "14px 20px", background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(12px)",
                        border: "2px solid #E5E7EB", borderRadius: "14px", color: "#000000", fontSize: "16px", outline: "none",
                        cursor: "pointer", fontWeight: 500, fontFamily: "inherit", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"
                      }}
                    >
                      <option value="trending">🔥 Trending</option>
                      <option value="newest">✨ Newest</option>
                    </select>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "40px" }}>Loading community prompts...</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
                  {filteredPrompts.length === 0 ? (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "80px", background: "rgba(255, 255, 255, 0.7)", borderRadius: "32px", border: "1px dashed #D4AF37" }}>
                      No public prompts found.
                    </div>
                  ) : (
                    filteredPrompts.map((p) => (
                      <div key={p.id} style={{
                        background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(12px)",
                        border: "1px solid rgba(212, 175, 55, 0.5)", borderRadius: "28px", padding: "28px",
                        display: "flex", flexDirection: "column", gap: "18px", transition: "transform 0.2s ease",
                        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)", position: "relative"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                        
                        {/* Header Row */}
                        <div className="flex flex-row items-start justify-between gap-2 w-full">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 1, minWidth: 0 }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold", color: "#4B5563", flexShrink: 0 }}>
                              {p.author_email.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#4B5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.author_email.split('@')[0]}
                            </span>
                          </div>
                          <span style={{ 
                            background: "rgba(212, 175, 55, 0.15)", color: "#AA8A27", 
                            padding: "4px 8px", borderRadius: "8px", fontSize: "10px", 
                            fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px",
                            lineHeight: 1.2, display: "inline-block", wordBreak: "break-word", flexShrink: 0 
                          }}>
                            {p.category}
                          </span>
                        </div>
                        
                        <h3 style={{ color: "#000000", fontSize: "20px", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                          {p.name}
                        </h3>
                        
                        <div style={{
                          background: "rgba(249, 250, 251, 0.6)", borderRadius: "16px", padding: "16px",
                          color: "#1f2937", fontSize: "14px", lineHeight: "1.6", height: "100px",
                          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical"
                        }}>
                          {p.prompt_text}
                        </div>
                        
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {Array.isArray(p.tags) ? p.tags.map((tag: string, idx: number) => (
                            <span key={idx} style={{ color: "#4b5563", fontSize: "11px", background: "rgba(243, 244, 246, 0.8)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                              #{tag}
                            </span>
                          )) : null}
                        </div>

                        {/* Actions Row */}
                        <div className="flex flex-wrap items-center justify-between mt-auto border-t border-black/5 pt-4 gap-3">
                          
                          <button onClick={() => handleUpvote(p.id)} style={{
                            display: "flex", alignItems: "center", gap: "6px", background: p.has_upvoted ? "#F4CE14" : "rgba(0,0,0,0.05)",
                            border: "none", borderRadius: "10px", padding: "8px 12px", color: "#000", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "background 0.2s"
                          }}>
                            <ThumbsUp size={16} fill={p.has_upvoted ? "#000" : "none"} /> {p.upvotes}
                          </button>
                          

                        </div>

                        {/* Report Link */}
                        <button onClick={() => handleReport(p.id)} style={{
                          position: "absolute", bottom: "16px", right: "24px", background: "none", border: "none",
                          color: "#9CA3AF", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer",
                          opacity: 0.6
                        }}>
                          <TriangleAlert size={10} /> Report
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>


      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", boxSizing: "border-box"
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-[#D4AF37]/30 rounded-[24px] p-6 md:p-8 w-full max-w-[450px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] relative"
            >
              <button onClick={() => setIsSettingsOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                <X size={20} />
              </button>

              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ width: "48px", height: "48px", background: "rgba(212, 175, 55, 0.1)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#AA8A27" }}>
                  <Key size={24} />
                </div>
                <h2 style={{ color: "#000000", fontSize: "24px", fontWeight: 800, margin: 0 }}>Settings</h2>
                <p style={{ color: "#6B7280", fontSize: "14px", marginTop: "4px" }}>Manage your account preferences</p>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", color: "#374151", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>API Configuration</label>
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {isEditingSettingsKey ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ position: "relative" }}>
                        <select value={settingsApiProvider} onChange={(e) => { setSettingsApiProvider(e.target.value); setSettingsApiModel(""); }} style={{ width: "100%", padding: "10px 32px 10px 12px", borderRadius: "8px", border: "2px solid #D4AF37", fontSize: "14px", outline: "none", appearance: "none", background: "#ffffff", color: settingsApiProvider === "" ? "#9CA3AF" : "#000000" }}>
                          <option value="" disabled hidden>Enter the API Name</option>
                          {Object.keys(PROVIDER_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={16} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }} />
                      </div>
                      <div style={{ position: "relative" }}>
                        <select value={settingsApiModel} onChange={(e) => setSettingsApiModel(e.target.value)} disabled={!settingsApiProvider} style={{ width: "100%", padding: "10px 32px 10px 12px", borderRadius: "8px", border: "2px solid #D4AF37", fontSize: "14px", outline: "none", appearance: "none", background: !settingsApiProvider ? "#F3F4F6" : "#ffffff", color: settingsApiModel === "" ? "#9CA3AF" : "#000000" }}>
                          <option value="" disabled hidden>{!settingsApiProvider ? "Select a provider first" : "Enter the Model"}</option>
                          {settingsApiProvider && PROVIDER_MODELS[settingsApiProvider]?.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown size={16} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF" }} />
                      </div>
                      <input type="text" value={settingsApiKey} onChange={(e) => setSettingsApiKey(e.target.value)} placeholder="Enter API Key (or leave empty for 'free')" style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "2px solid #D4AF37", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "#000" }} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={handleSaveSettingsKey} style={{ flex: 1, background: "#000000", color: "#ffffff", border: "none", borderRadius: "8px", padding: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><Save size={14} /> Save</button>
                        <button onClick={() => setIsEditingSettingsKey(false)} style={{ flex: 1, background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>Cancel</button>
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

          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            ::-webkit-scrollbar { width: 8px; height: 0px; }
            ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
            .scrollbar-hide::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
            .scrollbar-hide { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            body { background: #F3F3F3 !important; overflow-x: hidden; }

            .bg-wave-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: #F3F3F3; overflow: hidden; }
            .waves {
          position: absolute;
          bottom: 0;
          width: 100%;
          height: 100vh;
          min-height: 100vh;
        }
            .parallax > use { animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite; }
            .parallax > use:nth-child(1) { animation-delay: -2s; animation-duration: 7s; fill: rgba(255, 201, 0, 0.4); }
            .parallax > use:nth-child(2) { animation-delay: -3s; animation-duration: 10s; fill: rgba(255, 225, 0, 0.3); }
            .parallax > use:nth-child(3) { animation-delay: -4s; animation-duration: 13s; fill: rgba(254, 186, 23, 0.2); }
            .parallax > use:nth-child(4) { animation-delay: -5s; animation-duration: 20s; fill: #F3F4F4; }
            @keyframes move-forever { 0% { transform: translate3d(-90px,0,0); } 100% { transform: translate3d(85px,0,0); } }
          `}</style>
        </>
      )}
    </div>
  );
}
