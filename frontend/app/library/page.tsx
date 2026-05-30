"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type LibraryPrompt = {
  id: number;
  name: string;
  prompt_text: string;
  tags: string[];
  category: string;
  created_at: string;
};

export default function LibraryPage() {
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/library");
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
          <Link href="/history" style={{
            textDecoration: "none",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
          }}>
            History
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

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "50px 24px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "60px", textAlign: "center" }}>
          <div style={{
            width: "60px", height: "60px",
            background: "linear-gradient(135deg, #10b981, #3b82f6)",
            borderRadius: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "30px", marginBottom: "20px"
          }}>📚</div>
          <h1 style={{ color: "#fff", fontSize: "42px", fontWeight: 800, margin: 0, letterSpacing: "-1.5px" }}>
            Personal Prompt Library
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "18px", margin: "10px 0 30px", maxWidth: "600px" }}>
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
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px",
                color: "#fff",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.3s ease",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
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
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: "32px",
              color: "#64748b"
            }}>
              {searchQuery ? "No prompts match your search." : "Your library is empty. Generate a prompt to see it here!"}
            </div>
          ) : (
            filteredPrompts.map((p) => (
              <div key={p.id} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "28px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                transition: "transform 0.2s ease, background 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{
                    background: "rgba(99,102,241,0.15)",
                    color: "#a5b4fc",
                    padding: "4px 12px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {p.category}
                  </span>
                  <button
                    onClick={() => handleCopy(p.prompt_text, p.id)}
                    style={{
                      background: copiedId === p.id ? "#10b981" : "rgba(255,255,255,0.08)",
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
                
                <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                  {p.name}
                </h3>
                
                <div style={{
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                  color: "#94a3b8",
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
                    background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)"
                  }}></div>
                </div>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {p.tags.map((tag, idx) => (
                    <span key={idx} style={{
                      color: "#64748b",
                      fontSize: "12px",
                      background: "rgba(255,255,255,0.03)",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.05)"
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

      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 4px; }
      `}</style>
    </div>
  );
}
