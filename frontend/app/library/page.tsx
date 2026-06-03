"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8001/library");
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error("Failed to fetch library", error);
    }
  };

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
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button 
            onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", color: "#D4AF37", fontWeight: 700 }}
          >
            <ArrowLeft size={20} /> Back to Home
          </button>
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
    </div>
  );
}

