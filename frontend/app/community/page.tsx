"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, User, Settings, LogOut, Key, Save, Edit2, X, ChevronDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

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
  const { user, loading: authLoading, logout } = useAuth();
  
  // Navigation / Profile states
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
      const response = await fetch(`http://127.0.0.1:8000/community?user_id=${user.id}&sort_by=${sortBy}`);
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
      fetchCommunity();
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
      await fetch("http://127.0.0.1:8000/community/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, user_id: user.id })
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
      const response = await fetch("http://127.0.0.1:8000/community/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, user_id: user.id })
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
        await fetch(`http://127.0.0.1:8000/community/report/${promptId}`, {
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
                <Link href="/generator" style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#ffffff", background: "#000000", borderRadius: "10px", textDecoration: "none" }}>
                  Generator
                </Link>
                <Link href="/library" style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#ffffff", background: "#000000", borderRadius: "10px", textDecoration: "none" }}>
                  Library
                </Link>
                <Link href="/history" style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#ffffff", background: "#000000", borderRadius: "10px", textDecoration: "none" }}>
                  History
                </Link>
                <Link href="/community" style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#ffffff", background: "#333333", borderRadius: "10px", textDecoration: "none", boxShadow: "inset 0 0 0 1px #D4AF37" }}>
                  Community
                </Link>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "8px", background: "rgba(212, 175, 55, 0.1)",
                      border: "1px solid #D4AF37", borderRadius: "50%",
                      cursor: "pointer", color: "#AA8A27"
                    }}
                  >
                    <User size={18} />
                  </button>
                  {isProfileOpen && (
                    <div style={{
                      position: "absolute", top: "100%", right: 0, marginTop: "8px",
                      background: "#fff", border: "1px solid #eaeaea", borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", display: "flex",
                      flexDirection: "column", overflow: "hidden", minWidth: "120px", zIndex: 101
                    }}>
                      <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#e11d48", textAlign: "left" }}>
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
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "50px 24px 80px" }}>
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
                <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "800px", flexWrap: "wrap", justifyContent: "center" }}>
                  {/* Search Bar */}
                  <div style={{ position: "relative", flex: "1 1 300px" }}>
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
                    style={{
                      padding: "14px 20px", background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(12px)",
                      border: "2px solid #E5E7EB", borderRadius: "14px", color: "#000000", fontSize: "15px", outline: "none",
                      cursor: "pointer", fontWeight: 600
                    }}
                  >
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: "14px 20px", background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(12px)",
                      border: "2px solid #E5E7EB", borderRadius: "14px", color: "#000000", fontSize: "15px", outline: "none",
                      cursor: "pointer", fontWeight: 600
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold", color: "#4B5563" }}>
                              {p.author_email.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#4B5563", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p.author_email.split('@')[0]}
                            </span>
                          </div>
                          <span style={{ background: "rgba(212, 175, 55, 0.15)", color: "#AA8A27", padding: "4px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
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
                          {p.tags.map((tag, idx) => (
                            <span key={idx} style={{ color: "#4b5563", fontSize: "11px", background: "rgba(243, 244, 246, 0.8)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* Actions Row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "16px" }}>
                          
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

          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
            body { background: #F3F3F3 !important; overflow-x: hidden; }

            .bg-wave-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: #F3F3F3; overflow: hidden; }
            .waves { position: absolute; bottom: 0; width: 100%; height: 100vh; min-height: 100vh; }
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
