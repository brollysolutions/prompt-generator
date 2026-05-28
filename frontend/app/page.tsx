"use client";

import { useState } from "react";

type Question = {
  question: string;
  type?: string;
  options?: string[];
};

type SmartPromptResult = {
  title?: string;
  summary?: string;
  role?: string;
  context?: string;
  task?: string;
  constraints?: string;
  output_format?: string;
  tone?: string;
  smart_prompt?: string;
  quality_score?: number;
  quality_breakdown?: { [key: string]: number };
  quality_feedback?: string[];
  // fallback legacy fields
  final_instruction?: string;
  final_prompt?: string;
};

export default function Home() {
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [customAnswers, setCustomAnswers] = useState<{ [key: number]: string }>({});
  const [finalPrompt, setFinalPrompt] = useState<SmartPromptResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetAi, setTargetAi] = useState("");

  const [activeTab, setActiveTab] = useState<"generator" | "scorer">("generator");
  const [scoreInput, setScoreInput] = useState("");
  const [scoreResult, setScoreResult] = useState<any>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreCopied, setScoreCopied] = useState(false);

  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);

  const handleTestPrompt = async () => {
    const text =
      finalPrompt?.smart_prompt ||
      finalPrompt?.final_instruction ||
      finalPrompt?.final_prompt ||
      "";

    if (!text) return;

    try {
      setLoadingTest(true);
      setTestResponse(null);
      const response = await fetch("http://127.0.0.1:8000/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await response.json();
      setTestResponse(data.response);
      // Scroll to test response
      setTimeout(() => {
        document.getElementById("test-response-container")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error(error);
      alert("Failed to test prompt.");
    } finally {
      setLoadingTest(false);
    }
  };

  const handleScorePrompt = async () => {
    try {
      setLoadingScore(true);
      setScoreResult(null);
      const response = await fetch("http://127.0.0.1:8000/score-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scoreInput }),
      });
      const data = await response.json();
      setScoreResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to score prompt.");
    } finally {
      setLoadingScore(false);
    }
  };


  const handleGenerateQuestions = async () => {
    try {
      setLoadingQuestions(true);
      setFinalPrompt(null);
      setAnswers({});
      setCustomAnswers({});
      const response = await fetch("http://127.0.0.1:8000/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: userInput }),
      });
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (error) {
      console.error(error);
      alert("Failed to generate questions. Make sure the backend is running.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleGenerateFinalPrompt = async () => {
    try {
      setLoadingPrompt(true);

      // Merge custom answers into the answers sent to the backend
      const processedAnswers = { ...answers };
      Object.keys(customAnswers).forEach((key) => {
        const idx = parseInt(key);
        const customText = customAnswers[idx];
        if (customText && customText.trim()) {
          if (processedAnswers[idx] === "Custom Message") {
            processedAnswers[idx] = customText;
          } else if (processedAnswers[idx]?.includes("Custom Message")) {
            processedAnswers[idx] = processedAnswers[idx].replace("Custom Message", customText);
          }
        }
      });

      const response = await fetch("http://127.0.0.1:8000/generate-final-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: userInput,
          answers: processedAnswers,
          questions, // send questions so backend knows each question's text
          target_ai: targetAi,
        }),
      });
      const data = await response.json();
      setFinalPrompt(data);
      // Scroll to result
      setTimeout(() => {
        document.getElementById("smart-prompt-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error(error);
      alert("Failed to generate final prompt.");
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleCopy = () => {
    const text =
      finalPrompt?.smart_prompt ||
      finalPrompt?.final_instruction ||
      finalPrompt?.final_prompt ||
      "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const sections = [];

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
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <div style={{
            background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "20px", padding: "5px 14px", fontSize: "13px", fontWeight: 600,
          }}>
            Powered by Groq + Llama
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "50px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "30px", padding: "6px 18px", marginBottom: "24px",
            color: "#a5b4fc", fontSize: "13px", fontWeight: 600,
          }}>
            <span>⚡</span> AI-Powered Prompt Engineering
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 18px",
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
          }}>
            Generate{" "}
            <span style={{
              background: "linear-gradient(135deg, #6366f1, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Smart Prompts</span>
            <br />in seconds
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "18px", margin: 0, lineHeight: 1.6 }}>
            Describe your idea → Answer AI questions → Get a professional,
            copy-ready prompt for any AI tool.
          </p>
        </div>


        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            padding: "6px",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <button
              onClick={() => setActiveTab("generator")}
              style={{
                padding: "10px 24px",
                background: activeTab === "generator" ? "rgba(99,102,241,0.2)" : "transparent",
                color: activeTab === "generator" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              ✨ Generator
            </button>
            <button
              onClick={() => setActiveTab("scorer")}
              style={{
                padding: "10px 24px",
                background: activeTab === "scorer" ? "rgba(16,185,129,0.2)" : "transparent",
                color: activeTab === "scorer" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              🎯 Scorer
            </button>
          </div>
        </div>

        {activeTab === "scorer" && (
          <div>
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "24px",
              padding: "32px",
              marginBottom: "28px",
              backdropFilter: "blur(10px)",
            }}>
              <label style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "12px" }}>
                Your Prompt to Evaluate
              </label>
              <textarea
                placeholder="Paste your prompt here to get a score and suggestions..."
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                style={{
                  width: "100%", height: "160px", padding: "18px", borderRadius: "16px",
                  border: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "#f1f5f9", fontSize: "16px", outline: "none", resize: "none", marginBottom: "20px",
                  boxSizing: "border-box", lineHeight: 1.6, transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                onClick={handleScorePrompt}
                disabled={!scoreInput.trim() || loadingScore}
                style={{
                  padding: "16px 32px",
                  background: scoreInput.trim() ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.08)",
                  color: scoreInput.trim() ? "#ffffff" : "#475569",
                  border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: 700,
                  cursor: scoreInput.trim() ? "pointer" : "not-allowed", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: "10px",
                }}
              >
                {loadingScore ? "⏳ Scoring..." : "🎯 Score Prompt"}
              </button>
            </div>

            {scoreResult && (
              <div style={{ marginTop: "20px" }}>
                <div style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.15))",
                  border: "1px solid rgba(16,185,129,0.3)", borderRadius: "24px", padding: "32px", marginBottom: "20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div>
                    <h2 style={{ color: "#f1f5f9", fontSize: "28px", fontWeight: 800, margin: "0 0 10px" }}>Prompt Evaluation Score</h2>
                    <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0 }}>Here is how your prompt performed across key criteria.</p>
                  </div>
                  <div style={{
                    textAlign: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "20px", padding: "16px 24px", minWidth: "140px",
                  }}>
                    <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Total Score</div>
                    <div style={{
                      fontSize: "36px", fontWeight: 800,
                      color: scoreResult.score >= 80 ? "#10b981" : scoreResult.score >= 60 ? "#f59e0b" : "#ef4444",
                    }}>
                      {scoreResult.score}<span style={{ fontSize: "16px", color: "#475569" }}>/100</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "24px" }}>
                    <h3 style={{ color: "#f1f5f9", fontSize: "16px", fontWeight: 700, margin: "0 0 16px" }}>📊 Criteria Breakdown</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {Object.entries(scoreResult.criteria || {}).map(([label, score]) => {
                        const numericScore = typeof score === 'number' ? score : 0;
                        return (
                          <div key={label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <span style={{ color: "#94a3b8", fontSize: "13px", textTransform: "capitalize" }}>{label.replace('_', ' ')}</span>
                              <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{numericScore}/20</span>
                            </div>
                            <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(numericScore / 20) * 100}%`, background: "linear-gradient(90deg, #10b981, #059669)", borderRadius: "3px" }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "24px" }}>
                    <h3 style={{ color: "#f1f5f9", fontSize: "16px", fontWeight: 700, margin: "0 0 16px" }}>💡 Suggestions for Improvement</h3>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(scoreResult.suggestions || []).map((tip: any, i: number) => (
                        <li key={i} style={{ color: "#cbd5e1", fontSize: "13.5px", lineHeight: 1.5, display: "flex", gap: "10px", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
                          <span style={{ color: "#10b981" }}>•</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {scoreResult.rewritten_prompt && (
                  <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "20px", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "rgba(16,185,129,0.1)", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>
                      <span style={{ color: "#f1f5f9", fontSize: "15px", fontWeight: 700 }}>✨ AI Rewritten Prompt</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(scoreResult.rewritten_prompt); setScoreCopied(true); setTimeout(() => setScoreCopied(false), 2500); }}
                        style={{ padding: "8px 18px", background: scoreCopied ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", transition: "all 0.3s" }}
                      >
                        {scoreCopied ? "✅ Copied!" : "📋 Copy Prompt"}
                      </button>
                    </div>
                    <div style={{ padding: "28px 32px" }}>
                      <pre style={{ color: "#e2e8f0", fontSize: "15px", lineHeight: "1.85", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                        {scoreResult.rewritten_prompt}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "generator" && (
          <div id="generator-wrapper">

            {/* Input Card */}
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "24px",
              padding: "32px",
              marginBottom: "28px",
              backdropFilter: "blur(10px)",
            }}>
              <label style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "12px" }}>
                Your Idea
              </label>
              <textarea
                id="user-idea-input"
                placeholder="e.g. I want to build a SaaS landing page for a project management tool targeting remote teams..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                style={{
                  width: "100%",
                  height: "140px",
                  padding: "18px",
                  borderRadius: "16px",
                  border: "2px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#f1f5f9",
                  fontSize: "16px",
                  outline: "none",
                  resize: "none",
                  marginBottom: "20px",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                id="generate-questions-btn"
                onClick={handleGenerateQuestions}
                disabled={!userInput.trim() || loadingQuestions}
                style={{
                  padding: "16px 32px",
                  background: userInput.trim()
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.08)",
                  color: userInput.trim() ? "#ffffff" : "#475569",
                  border: "none",
                  borderRadius: "14px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: userInput.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {loadingQuestions ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                    Analyzing your idea...
                  </>
                ) : (
                  <> Get Start!</>
                )}
              </button>
            </div>

            {/* Questions Section */}
            {questions.length > 0 && (
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "32px",
                marginBottom: "28px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
                  <div style={{
                    width: "36px", height: "36px",
                    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                    borderRadius: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px",
                  }}>❓</div>
                  <div>
                    <h2 style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                      AI Follow-up Questions
                    </h2>
                    <p style={{ color: "#64748b", fontSize: "13px", margin: "3px 0 0" }}>
                      Answer these to generate a precise smart prompt
                    </p>
                  </div>
                  <div style={{
                    marginLeft: "auto",
                    background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: "20px", padding: "4px 12px", fontSize: "13px", fontWeight: 600,
                  }}>
                    {questions.length} questions
                  </div>
                </div>

                {questions.map((q, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: "22px",
                      padding: "22px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255,255,255,0.07)",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                      <div style={{
                        minWidth: "28px", height: "28px",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        borderRadius: "8px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", fontWeight: 700, color: "#fff",
                        marginTop: "2px",
                      }}>
                        {index + 1}
                      </div>
                      <p style={{ color: "#e2e8f0", fontSize: "16px", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                        {q.question}
                      </p>
                    </div>

                    {/* TEXT INPUT (default fallback) */}
                    {q.type !== "textarea" &&
                      q.type !== "text-area" &&
                      q.type !== "paragraph" &&
                      !((q.type === "dropdown" || q.type === "select" || q.type === "checkbox" || q.type === "radio") &&
                        q.options && q.options.length > 0) && (
                        <input
                          id={`answer-${index}`}
                          type="text"
                          placeholder="Type your answer here..."
                          value={answers[index] || ""}
                          onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: "12px",
                            border: "2px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.05)",
                            color: "#f1f5f9",
                            fontSize: "15px",
                            outline: "none",
                            boxSizing: "border-box",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
                          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                        />
                      )}

                    {/* TEXTAREA */}
                    {(q.type === "textarea" || q.type === "text-area" || q.type === "paragraph") && (
                      <textarea
                        id={`answer-${index}`}
                        placeholder="Type your answer here..."
                        value={answers[index] || ""}
                        onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100px",
                          padding: "14px 16px",
                          borderRadius: "12px",
                          border: "2px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#f1f5f9",
                          fontSize: "15px",
                          outline: "none",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
                        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                    )}

                    {/* DROPDOWN */}
                    {(q.type === "dropdown" || q.type === "select") &&
                      q.options && q.options.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <select
                            id={`answer-${index}`}
                            value={answers[index] || ""}
                            onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "14px 16px",
                              borderRadius: "12px",
                              border: "2px solid rgba(255,255,255,0.1)",
                              background: "#1e1b4b",
                              color: "#f1f5f9",
                              fontSize: "15px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="">Select an option...</option>
                            {q.options.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                            <option value="Custom Message">Custom Message...</option>
                          </select>

                          {answers[index] === "Custom Message" && (
                            <input
                              type="text"
                              placeholder="Type your custom message here..."
                              value={customAnswers[index] || ""}
                              onChange={(e) => setCustomAnswers({ ...customAnswers, [index]: e.target.value })}
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: "12px",
                                border: "2px solid rgba(99,102,241,0.4)",
                                background: "rgba(99,102,241,0.05)",
                                color: "#f1f5f9",
                                fontSize: "15px",
                                outline: "none",
                                boxSizing: "border-box",
                                animation: "fadeIn 0.3s ease-out",
                              }}
                            />
                          )}
                        </div>
                      )}

                    {/* CHECKBOX */}
                    {q.type === "checkbox" && q.options && q.options.length > 0 && (
                      <div style={{ marginTop: "4px" }}>
                        {q.options.map((option, i) => {
                          const current = answers[index]?.split(", ").filter(Boolean) || [];
                          const checked = current.includes(option);
                          return (
                            <label key={i} style={{
                              display: "flex", alignItems: "center",
                              gap: "12px", marginBottom: "10px",
                              color: "#cbd5e1", fontSize: "15px", cursor: "pointer",
                            }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...current, option]
                                    : current.filter((x) => x !== option);
                                  setAnswers({ ...answers, [index]: updated.join(", ") });
                                }}
                                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#6366f1" }}
                              />
                              {option}
                            </label>
                          );
                        })}
                        {/* Custom Message Checkbox */}
                        <label style={{
                          display: "flex", alignItems: "center",
                          gap: "12px", marginBottom: "10px",
                          color: "#cbd5e1", fontSize: "15px", cursor: "pointer",
                        }}>
                          <input
                            type="checkbox"
                            checked={(answers[index]?.split(", ").filter(Boolean) || []).includes("Custom Message")}
                            onChange={(e) => {
                              const current = answers[index]?.split(", ").filter(Boolean) || [];
                              const updated = e.target.checked
                                ? [...current, "Custom Message"]
                                : current.filter((x) => x !== "Custom Message");
                              setAnswers({ ...answers, [index]: updated.join(", ") });
                            }}
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#6366f1" }}
                          />
                          Custom Message
                        </label>

                        {(answers[index]?.split(", ").filter(Boolean) || []).includes("Custom Message") && (
                          <input
                            type="text"
                            placeholder="Type your custom message here..."
                            value={customAnswers[index] || ""}
                            onChange={(e) => setCustomAnswers({ ...customAnswers, [index]: e.target.value })}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "14px 16px",
                              borderRadius: "12px",
                              border: "2px solid rgba(99,102,241,0.4)",
                              background: "rgba(99,102,241,0.05)",
                              color: "#f1f5f9",
                              fontSize: "15px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginTop: "8px",
                              animation: "fadeIn 0.3s ease-out",
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* RADIO */}
                    {q.type === "radio" && q.options && q.options.length > 0 && (
                      <div style={{ marginTop: "4px" }}>
                        {q.options.map((option, i) => (
                          <label key={i} style={{
                            display: "flex", alignItems: "center",
                            gap: "12px", marginBottom: "10px",
                            color: "#cbd5e1", fontSize: "15px", cursor: "pointer",
                          }}>
                            <input
                              type="radio"
                              name={`question-${index}`}
                              checked={answers[index] === option}
                              onChange={() => setAnswers({ ...answers, [index]: option })}
                              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#6366f1" }}
                            />
                            {option}
                          </label>
                        ))}
                        {/* Custom Message Radio */}
                        <label style={{
                          display: "flex", alignItems: "center",
                          gap: "12px", marginBottom: "10px",
                          color: "#cbd5e1", fontSize: "15px", cursor: "pointer",
                        }}>
                          <input
                            type="radio"
                            name={`question-${index}`}
                            checked={answers[index] === "Custom Message"}
                            onChange={() => setAnswers({ ...answers, [index]: "Custom Message" })}
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#6366f1" }}
                          />
                          Custom Message
                        </label>

                        {answers[index] === "Custom Message" && (
                          <input
                            type="text"
                            placeholder="Type your custom message here..."
                            value={customAnswers[index] || ""}
                            onChange={(e) => setCustomAnswers({ ...customAnswers, [index]: e.target.value })}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "14px 16px",
                              borderRadius: "12px",
                              border: "2px solid rgba(99,102,241,0.4)",
                              background: "rgba(99,102,241,0.05)",
                              color: "#f1f5f9",
                              fontSize: "15px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginTop: "8px",
                              animation: "fadeIn 0.3s ease-out",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Target AI Selection */}
                <div style={{ marginTop: "20px", marginBottom: "15px" }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "14px", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Target AI Model (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ChatGPT, Claude, Gemini..."
                    value={targetAi}
                    onChange={(e) => setTargetAi(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                      borderRadius: "12px",
                      color: "#f8fafc",
                      fontSize: "15px",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(99, 102, 241, 0.5)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(99, 102, 241, 0.2)"}
                  />
                  <p style={{ color: "#64748b", fontSize: "12px", marginTop: "6px" }}>
                    Optimizes the prompt for a specific model's strengths.
                  </p>
                </div>

                {/* Generate Prompt Button */}
                <button
                  id="generate-prompt-btn"
                  onClick={handleGenerateFinalPrompt}
                  disabled={loadingPrompt}
                  style={{
                    marginTop: "12px",
                    padding: "18px 36px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "14px",
                    fontSize: "17px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 8px 30px rgba(16,185,129,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {loadingPrompt ? (
                    <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Building your Smart Prompt...</>
                  ) : (
                    <> 🚀 Generate Smart Prompt</>
                  )}
                </button>
              </div>
            )}

            {/* ===== SMART PROMPT RESULT ===== */}
            {finalPrompt && (
              <div id="smart-prompt-result" style={{ marginTop: "10px" }}>

                {/* Result Header */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "24px",
                  padding: "32px",
                  marginBottom: "20px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
                        borderRadius: "20px", padding: "5px 14px",
                        fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px",
                        marginBottom: "14px",
                      }}>
                        ✅ Smart Prompt Generated
                      </div>
                      <h2 style={{
                        color: "#f1f5f9", fontSize: "28px", fontWeight: 800,
                        margin: "0 0 10px", lineHeight: 1.2,
                      }}>
                        {finalPrompt.title || "Your Smart Prompt"}
                      </h2>
                      {finalPrompt.summary && (
                        <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0, lineHeight: 1.6, maxWidth: "600px" }}>
                          {finalPrompt.summary}
                        </p>
                      )}
                    </div>

                    {/* Best Score Badge removed as requested */}
                  </div>
                </div>

                {/* Quality Analysis Details removed as requested */}

                {/* Platform Selection - DIRECT OPEN */}
                <div style={{
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "24px",
                  padding: "24px",
                  marginBottom: "20px",
                  textAlign: "center"
                }}>
                  <h3 style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>
                    🚀 Use with Your Preferred AI
                  </h3>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    {[
                      { name: "ChatGPT", icon: "🤖", url: "https://chatgpt.com/?q=", color: "#10a37f" },
                      { name: "Claude", icon: "🧠", url: "https://claude.ai/new?q=", color: "#d97757" },
                      { name: "Gemini", icon: "✨", url: "https://gemini.google.com/app", color: "#1a73e8" },
                    ].map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => {
                          const text = finalPrompt.smart_prompt || finalPrompt.final_instruction || finalPrompt.final_prompt || "";
                          navigator.clipboard.writeText(text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2500);

                          let finalUrl = tool.url;
                          if (tool.name !== "Gemini" && text.length < 2000) {
                            finalUrl += encodeURIComponent(text);
                          }
                          window.open(finalUrl, "_blank");
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "14px",
                          padding: "12px 20px",
                          color: "#fff",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>{tool.icon}</span>
                        Open in {tool.name}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "#64748b", fontSize: "12px", marginTop: "12px" }}>
                    Clicking a button will copy the prompt and open the AI platform.
                  </p>
                </div>

                {/* Metadata Sections Grid */}
                {sections.some(s => finalPrompt[s.key as keyof SmartPromptResult]) && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                    marginBottom: "20px",
                  }}>
                    {sections.map(({ key, label, icon, color }) => {
                      const value = finalPrompt[key as keyof SmartPromptResult];
                      if (!value) return null;
                      const isActive = activeSection === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setActiveSection(isActive ? null : key)}
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${isActive ? color + "60" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "16px",
                            padding: "20px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            boxShadow: isActive ? `0 0 20px ${color}20` : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: isActive ? "12px" : "0" }}>
                            <div style={{
                              width: "32px", height: "32px",
                              background: color + "20",
                              borderRadius: "8px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "14px", border: `1px solid ${color}40`,
                            }}>{icon}</div>
                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "14px" }}>
                              {label.replace(/^.+ /, "")}
                            </span>
                            <span style={{
                              marginLeft: "auto", color: "#475569", fontSize: "12px",
                              transform: isActive ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s",
                            }}>▼</span>
                          </div>
                          {isActive && (
                            <p style={{
                              color: "#94a3b8", fontSize: "14px", margin: 0,
                              lineHeight: 1.7, paddingTop: "4px",
                              borderTop: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              {value as string}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* The Big Smart Prompt */}
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
                }}>
                  {/* Prompt toolbar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 24px",
                    background: "rgba(99,102,241,0.1)",
                    borderBottom: "1px solid rgba(99,102,241,0.2)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ff5f57" }} />
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#febc2e" }} />
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#28c840" }} />
                      </div>
                      <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "8px" }}>
                        smart-prompt.txt
                      </span>
                    </div>
                    <button
                      id="copy-prompt-btn"
                      onClick={handleCopy}
                      style={{
                        padding: "8px 18px",
                        background: copied
                          ? "linear-gradient(135deg, #10b981, #059669)"
                          : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        transition: "all 0.3s",
                      }}
                    >
                      {copied ? "✅ Copied!" : "📋 Copy Prompt"}
                    </button>
                  </div>

                  {/* Prompt Content */}
                  <div style={{ padding: "28px 32px" }}>
                    <pre style={{
                      color: "#e2e8f0",
                      fontSize: "15px",
                      lineHeight: "1.85",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}>
                      {finalPrompt.smart_prompt ||
                        finalPrompt.final_instruction ||
                        finalPrompt.final_prompt ||
                        "No prompt generated."}
                    </pre>
                  </div>
                </div>

                {/* In-App Prompt Tester */}
                <div style={{
                  marginTop: "40px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "24px",
                  padding: "32px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <div style={{
                      width: "36px", height: "36px",
                      background: "linear-gradient(135deg, #10b981, #0ea5e9)",
                      borderRadius: "10px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                    }}>🧪</div>
                    <div>
                      <h2 style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                        In-App Prompt Tester
                      </h2>
                      <p style={{ color: "#64748b", fontSize: "14px", margin: "3px 0 0" }}>
                        Test your generated prompt instantly without leaving the app
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTestPrompt}
                    disabled={loadingTest}
                    style={{
                      padding: "16px 32px",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "14px",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      transition: "all 0.2s",
                    }}
                  >
                    {loadingTest ? (
                      <>
                        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                        AI is thinking...
                      </>
                    ) : (
                      <> ⚡ Test Prompt Instantly</>
                    )}
                  </button>

                  {testResponse && (
                    <div id="test-response-container" style={{
                      marginTop: "24px",
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      borderRadius: "20px",
                      padding: "24px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ color: "#10b981", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          AI Response
                        </span>
                      </div>
                      <div style={{
                        color: "#e2e8f0",
                        fontSize: "15px",
                        lineHeight: "1.75",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {testResponse}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div style={{
                  marginTop: "30px",
                  display: "flex", justifyContent: "center",
                }}>
                  <button
                    onClick={() => { setQuestions([]); setFinalPrompt(null); setAnswers({}); setUserInput(""); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "14px",
                      padding: "14px 28px",
                      color: "#f87171", fontSize: "15px",
                      cursor: "pointer", fontWeight: 700,
                      transition: "all 0.2s",
                    }}
                  >
                    🔄 Create Another Smart Prompt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #475569 !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 4px; }
        button:hover { opacity: 0.92; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}