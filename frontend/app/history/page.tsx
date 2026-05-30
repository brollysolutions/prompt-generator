"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "18px 40px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          width: "38px", height: "38px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}>✨</div>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "20px", letterSpacing: "-0.3px" }}>
          Smart Prompt Generator
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
          <Link href="/library" style={{
            textDecoration: "none",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
          }}>
            Library
          </Link>
          <Link href="/" style={{
            textDecoration: "none",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
          }}>
            Generator
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "50px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
          <div style={{
            width: "48px", height: "48px",
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
            borderRadius: "14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px",
          }}>📜</div>
          <div>
            <h1 style={{ color: "#fff", fontSize: "32px", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
              Version History
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "16px", margin: "4px 0 0" }}>
              View, compare, and restore your previous prompt versions.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {promptHistory.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "60px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "24px",
              color: "#64748b"
            }}>
              No history found for this session.
            </div>
          ) : (
            promptHistory.map((version) => (
              <div key={version.id} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                      background: version.source.includes('generated') ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)',
                      color: version.source.includes('generated') ? '#34d399' : '#a5b4fc',
                      padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: "0.5px"
                    }}>
                      {version.source}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "13px" }}>
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {editingId === version.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(version.id)}
                          style={{
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            border: "none", borderRadius: "10px",
                            padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "none", borderRadius: "10px",
                            padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
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
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "10px",
                            padding: "6px 14px", color: "#94a3b8", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setIsComparing(true);
                            setCompareVersion(version);
                          }}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "10px",
                            padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Compare
                        </button>
                        <button
                          onClick={() => handleRestore(version)}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "10px",
                            padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Restore
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
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: "16px",
                      padding: "16px",
                      color: "#e2e8f0",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                ) : (
                  <div style={{
                    background: "rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "16px",
                    padding: "20px",
                    color: "#94a3b8",
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

      {/* Comparison Modal */}
      {isComparing && compareVersion && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
          zIndex: 1000, display: "flex", flexDirection: "column",
          padding: "40px", boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ color: "#fff", margin: 0 }}>Version Comparison</h2>
            <button
              onClick={() => setIsComparing(false)}
              style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                width: "40px", height: "40px", color: "#fff", fontSize: "20px", cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ color: "#94a3b8", marginBottom: "12px", fontWeight: 600 }}>Current Draft</div>
              <div style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px", padding: "24px", overflowY: "auto", color: "#e2e8f0",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }}>
                {compareVersion.prompt_text}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ color: "#94a3b8", marginBottom: "12px", fontWeight: 600 }}>
                Historical Version ({new Date(compareVersion.created_at).toLocaleString()})
              </div>
              <div style={{
                flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px", padding: "24px", overflowY: "auto", color: "#e2e8f0",
                fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }}>
                {currentPrompt?.smart_prompt || currentPrompt?.final_instruction || currentPrompt?.final_prompt || "No current draft."}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 4px; }
        button:hover { opacity: 0.92; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}
