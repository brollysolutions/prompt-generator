"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, RotateCcw, Edit, Maximize2, X } from "lucide-react";

type SmartPromptResult = {
  smart_prompt?: string;
  final_instruction?: string;
  final_prompt?: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");
  const [promptHistory, setPromptHistory] = useState<any[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<SmartPromptResult | null>(null);
  
  const [isComparing, setIsComparing] = useState(false);
  const [compareVersion, setCompareVersion] = useState<any | null>(null);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  useEffect(() => {
    const sId = localStorage.getItem("sessionId");
    const savedPrompt = localStorage.getItem("finalPrompt");
    
    if (sId) {
      setSessionId(sId);
    }
    
    fetchHistory();
    
    if (savedPrompt) {
      setCurrentPrompt(JSON.parse(savedPrompt));
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/history`);
      const data = await response.json();
      setPromptHistory(data.history || []);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  const handleRestore = async (version: any) => {
    if (confirm("Restore this version? This will move your current draft to history and replace it with this version.")) {
      // 1. Save current draft to history if it exists
      const currentDraftText = currentPrompt?.smart_prompt || currentPrompt?.final_instruction || currentPrompt?.final_prompt;
      
      if (currentDraftText && sessionId) {
        try {
          await fetch("http://127.0.0.1:8000/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              prompt_text: currentDraftText,
              source: "replaced (restore)"
            }),
          });
        } catch (error) {
          console.error("Failed to save current draft before restore", error);
        }
      }

      // 2. Restore the selected version
      const restoredPrompt = {
        ...currentPrompt,
        smart_prompt: version.prompt_text,
        final_instruction: undefined,
        final_prompt: undefined
      };
      localStorage.setItem("finalPrompt", JSON.stringify(restoredPrompt));
      setCurrentPrompt(restoredPrompt);
      fetchHistory();
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editBuffer.trim() || !sessionId) return;
    try {
      await fetch("http://127.0.0.1:8000/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          prompt_text: editBuffer,
          source: "edited (history)"
        }),
      });
      setEditingId(null);
      fetchHistory();
    } catch (error) {
      console.error("Failed to save edited version", error);
    }
  };

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
              href="/library"
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
              Library
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
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "50px 24px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
            <div style={{
              width: "48px", height: "48px",
              background: "#D4AF37",
              borderRadius: "14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px",
              color: "#000000"
            }}>📜</div>
            <div>
              <h1 style={{ color: "#000000", fontSize: "32px", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                Version History
              </h1>
              <p style={{ color: "#374151", fontSize: "16px", margin: "4px 0 0", fontWeight: 500 }}>
                View, compare, and restore your previous prompt versions.
              </p>
            </div>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        background: version.source.includes('generated') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(212, 175, 55, 0.1)',
                        color: version.source.includes('generated') ? '#10b981' : '#AA8A27',
                        padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: "0.5px"
                      }}>
                        {version.source}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "13px", fontWeight: 500 }}>
                        <Clock size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {editingId === version.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(version.id)}
                            style={{
                              background: "#000000",
                              border: "none", borderRadius: "10px",
                              padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            Save Changes
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
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(12px)",
          zIndex: 1000, display: "flex", flexDirection: "column",
          padding: "40px", boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ color: "#000000", margin: 0, fontWeight: 800 }}>Version Comparison</h2>
            <button
              onClick={() => setIsComparing(false)}
              style={{
                background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "50%",
                width: "40px", height: "40px", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ color: "#AA8A27", marginBottom: "12px", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>Current Draft</div>
              <div style={{
                flex: 1, background: "rgba(249, 250, 251, 0.8)", border: "2px solid #D4AF37",
                borderRadius: "20px", padding: "24px", overflowY: "auto", color: "#000000",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }}>
                {compareVersion.prompt_text}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ color: "#AA8A27", marginBottom: "12px", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>
                Historical Version ({new Date(compareVersion.created_at).toLocaleString()})
              </div>
              <div style={{
                flex: 1, background: "rgba(249, 250, 251, 0.8)", border: "2px solid #D4AF37",
                borderRadius: "20px", padding: "24px", overflowY: "auto", color: "#000000",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }}>
                {currentPrompt?.smart_prompt || currentPrompt?.final_instruction || currentPrompt?.final_prompt || "No current draft."}
              </div>
            </div>
          </div>
        </div>
      )}

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
        button:hover { opacity: 0.92; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}
