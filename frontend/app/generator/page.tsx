"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, ShieldCheck, Copy, Play, Clock, X, Trash2, FileText, Sparkles, Download, Star, Calculator } from "lucide-react";
import { useRouter } from "next/navigation";
import { GetStartedButton } from "@/components/ui/get-started-button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Question = {
  question: string;
  type?: string;
  options?: string[];
};

type SmartPromptResult = {
  id?: number;
  timestamp?: string;
  user_idea?: string;
  title?: string;
  summary?: string;
  role?: string;
  context?: string;
  task?: string;
  constraints?: string;
  output_format?: string;
  tone?: string;
  smart_prompt?: string;
  score?: number;
  quality_score?: number;
  quality_breakdown?: { [key: string]: number };
  quality_feedback?: string[];
  // fallback legacy fields
  final_instruction?: string;
  final_prompt?: string;
};

export default function GeneratorPage() {
  const router = useRouter();
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [customAnswers, setCustomAnswers] = useState<{ [key: number]: string }>({});
  const [finalPrompt, setFinalPrompt] = useState<SmartPromptResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetAi, setTargetAi] = useState("");

  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);
  const [loadingScore, setLoadingScore] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [enhanceInstruction, setEnhanceInstruction] = useState("");
  const [loadingEnhance, setLoadingEnhance] = useState(false);

  const handleEnhancePrompt = async () => {
    const text =
      finalPrompt?.smart_prompt ||
      finalPrompt?.final_instruction ||
      finalPrompt?.final_prompt ||
      "";

    if (!text || !enhanceInstruction.trim()) return;

    try {
      setLoadingEnhance(true);
      const response = await fetch("http://127.0.0.1:8000/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, instruction: enhanceInstruction }),
      });
      const data = await response.json();
      
      const updatedPrompt = {
        ...finalPrompt,
        smart_prompt: data.enhanced_prompt,
        // Reset score since the content changed significantly
        quality_score: undefined,
        quality_breakdown: undefined,
        quality_feedback: undefined
      };
      
      setFinalPrompt(updatedPrompt);
      setEnhanceInstruction("");
      localStorage.setItem("finalPrompt", JSON.stringify(updatedPrompt));

      // Update in history as well if needed, or just let it stay as a new entry next time they "Save"
    } catch (error) {
      console.error(error);
      alert("Failed to enhance prompt.");
    } finally {
      setLoadingEnhance(false);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    const hydrate = () => {
      const savedUserInput = localStorage.getItem("userInput");
      const savedQuestions = localStorage.getItem("questions");
      const savedAnswers = localStorage.getItem("answers");
      const savedCustomAnswers = localStorage.getItem("customAnswers");
      const savedFinalPrompt = localStorage.getItem("finalPrompt");
      const savedTargetAi = localStorage.getItem("targetAi");
      const savedTestResponse = localStorage.getItem("testResponse");
      const savedHistory = localStorage.getItem("promptHistory");

      if (savedUserInput) setUserInput(savedUserInput);
      if (savedQuestions) setQuestions(JSON.parse(savedQuestions));
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      if (savedCustomAnswers) setCustomAnswers(JSON.parse(savedCustomAnswers));
      if (savedFinalPrompt) setFinalPrompt(JSON.parse(savedFinalPrompt));
      if (savedTargetAi) setTargetAi(savedTargetAi);
      if (savedTestResponse) setTestResponse(savedTestResponse);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    };

    hydrate();
  }, []);

  const handleScorePrompt = async () => {
    const text =
      finalPrompt?.smart_prompt ||
      finalPrompt?.final_instruction ||
      finalPrompt?.final_prompt ||
      "";

    if (!text) return;

    try {
      setLoadingScore(true);
      const response = await fetch("http://127.0.0.1:8000/score-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await response.json();
      
      const updatedPrompt = {
        ...finalPrompt,
        quality_score: data.score,
        quality_breakdown: data.criteria,
        quality_feedback: data.suggestions,
        rewritten_prompt: data.rewritten_prompt
      };
      setFinalPrompt(updatedPrompt);
      localStorage.setItem("finalPrompt", JSON.stringify(updatedPrompt));
    } catch (error) {
      console.error(error);
      alert("Failed to score prompt.");
    } finally {
      setLoadingScore(false);
    }
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (userInput) localStorage.setItem("userInput", userInput);
  }, [userInput]);

  useEffect(() => {
    if (questions.length > 0) localStorage.setItem("questions", JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    if (Object.keys(answers).length > 0) localStorage.setItem("answers", JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    if (Object.keys(customAnswers).length > 0) localStorage.setItem("customAnswers", JSON.stringify(customAnswers));
  }, [customAnswers]);

  useEffect(() => {
    if (finalPrompt) localStorage.setItem("finalPrompt", JSON.stringify(finalPrompt));
  }, [finalPrompt]);

  useEffect(() => {
    if (targetAi) localStorage.setItem("targetAi", targetAi);
  }, [targetAi]);

  useEffect(() => {
    if (testResponse) localStorage.setItem("testResponse", testResponse);
  }, [testResponse]);



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
          questions,
          target_ai: targetAi,
        }),
      });
      const data = await response.json();
      
      // Ensure score data is correctly mapped if coming from initial generation
      const finalData = {
        ...data,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        user_idea: userInput,
        quality_score: data.quality_score ?? data.score,
        quality_breakdown: data.quality_breakdown,
        quality_feedback: data.quality_feedback
      };
      
      setFinalPrompt(finalData);
      localStorage.setItem("finalPrompt", JSON.stringify(finalData));

      // Add to history
      const newHistory = [finalData, ...history.slice(0, 19)]; // Keep last 20
      setHistory(newHistory);
      localStorage.setItem("promptHistory", JSON.stringify(newHistory));
      
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

  const handleCopyMarkdown = () => {
    const text =
      finalPrompt?.smart_prompt ||
      finalPrompt?.final_instruction ||
      finalPrompt?.final_prompt ||
      "";
    const markdown = "```markdown\n" + text + "\n```";
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
            <button 
              onClick={() => setShowHistory(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#D4AF37",
                background: "#ffffff",
                border: "1px solid #D4AF37",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <Clock size={16} /> History
            </button>
            <button 
              onClick={() => {
                if(confirm("Clear all your work?")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#6b7280",
                background: "#f3f4f6",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer"
              }}
            >
              Reset
            </button>
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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          id="generator-wrapper"
        >
          {/* Input Card with Static Gold Border */}
          <div style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212, 175, 55, 0.5)",
            padding: "32px",
            width: "100%",
            borderRadius: "24px",
            marginBottom: "28px",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ color: "#D4AF37", fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Your Idea
              </label>
            </div>

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
                border: "2px solid #D4AF37",
                background: "rgba(249, 250, 251, 0.6)",
                color: "#000000",
                fontSize: "16px",
                outline: "none",
                resize: "none",
                marginBottom: "20px",
                boxSizing: "border-box",
                lineHeight: 1.6,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#D4AF37")}
              onBlur={(e) => (e.target.style.borderColor = "#D4AF37")}
            />
            <GetStartedButton
              onClick={handleGenerateQuestions}
              disabled={!userInput.trim()}
              loading={loadingQuestions}
            />
          </div>

          {/* Questions Section */}
          <AnimatePresence>
            {questions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(212, 175, 55, 0.5)",
                  borderRadius: "24px",
                  padding: "32px",
                  marginBottom: "28px",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
                  <div style={{
                    width: "36px", height: "36px",
                    background: "#D4AF37",
                    borderRadius: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px",
                    color: "#000000"
                  }}>❓</div>
                  <div>
                    <h2 style={{ color: "#000000", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                      AI Follow-up Questions
                    </h2>
                    <p style={{ color: "#D4AF37", fontSize: "13px", margin: "3px 0 0" }}>
                      Answer these to generate a precise smart prompt
                    </p>
                  </div>
                  <div style={{
                    marginLeft: "auto",
                    background: "#f3f4f6", color: "#D4AF37",
                    border: "1px solid #D4AF37",
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
                      background: "#f9fafb",
                      borderRadius: "16px",
                      border: "1px solid #D4AF37",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                      <div style={{
                        minWidth: "28px", height: "28px",
                        background: "#D4AF37",
                        borderRadius: "8px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", fontWeight: 700, color: "#000000",
                        marginTop: "2px",
                      }}>
                        {index + 1}
                      </div>
                      <p style={{ color: "#1f2937", fontSize: "16px", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                        {q.question}
                      </p>
                    </div>

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
                            border: "2px solid #D4AF37",
                            background: "#ffffff",
                            color: "#000000",
                            fontSize: "15px",
                            outline: "none",
                            boxSizing: "border-box",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "#D4AF37")}
                          onBlur={(e) => (e.target.style.borderColor = "#D4AF37")}
                        />
                      )}

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
                          border: "2px solid #D4AF37",
                          background: "#ffffff",
                          color: "#000000",
                          fontSize: "15px",
                          outline: "none",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "#D4AF37")}
                        onBlur={(e) => (e.target.style.borderColor = "#D4AF37")}
                      />
                    )}

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
                              border: "2px solid #D4AF37",
                              background: "#ffffff",
                              color: "#000000",
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
                                border: "2px solid #D4AF37",
                                background: "#ffffff",
                                color: "#000000",
                                fontSize: "15px",
                                outline: "none",
                                boxSizing: "border-box",
                                animation: "fadeIn 0.3s ease-out",
                              }}
                            />
                          )}
                        </div>
                      )}

                    {q.type === "checkbox" && q.options && q.options.length > 0 && (
                      <div style={{ marginTop: "4px" }}>
                        {q.options.map((option, i) => {
                          const current = answers[index]?.split(", ").filter(Boolean) || [];
                          const checked = current.includes(option);
                          return (
                            <label key={i} style={{
                              display: "flex", alignItems: "center",
                              gap: "12px", marginBottom: "10px",
                              color: "#374151", fontSize: "15px", cursor: "pointer",
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
                                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#D4AF37" }}
                              />
                              {option}
                            </label>
                          );
                        })}
                        {/* Add Custom Message Checkbox */}
                        <label style={{
                          display: "flex", alignItems: "center",
                          gap: "12px", marginBottom: "10px",
                          color: "#374151", fontSize: "15px", cursor: "pointer",
                        }}>
                          <input
                            type="checkbox"
                            checked={answers[index]?.includes("Custom Message") || false}
                            onChange={(e) => {
                              const current = answers[index]?.split(", ").filter(Boolean) || [];
                              const updated = e.target.checked
                                ? [...current, "Custom Message"]
                                : current.filter((x) => x !== "Custom Message");
                              setAnswers({ ...answers, [index]: updated.join(", ") });
                            }}
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#D4AF37" }}
                          />
                          Custom Message...
                        </label>

                        {answers[index]?.includes("Custom Message") && (
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
                              border: "2px solid #D4AF37",
                              background: "#ffffff",
                              color: "#000000",
                              fontSize: "15px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginTop: "10px",
                              animation: "fadeIn 0.3s ease-out",
                            }}
                          />
                        )}
                      </div>
                    )}

                    {q.type === "radio" && q.options && q.options.length > 0 && (
                      <div style={{ marginTop: "4px" }}>
                        {q.options.map((option, i) => (
                          <label key={i} style={{
                            display: "flex", alignItems: "center",
                            gap: "12px", marginBottom: "10px",
                            color: "#374151", fontSize: "15px", cursor: "pointer",
                          }}>
                            <input
                              type="radio"
                              name={`question-${index}`}
                              checked={answers[index] === option}
                              onChange={() => setAnswers({ ...answers, [index]: option })}
                              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#D4AF37" }}
                            />
                            {option}
                          </label>
                        ))}
                        {/* Add Custom Message Radio */}
                        <label style={{
                          display: "flex", alignItems: "center",
                          gap: "12px", marginBottom: "10px",
                          color: "#374151", fontSize: "15px", cursor: "pointer",
                        }}>
                          <input
                            type="radio"
                            name={`question-${index}`}
                            checked={answers[index] === "Custom Message"}
                            onChange={() => setAnswers({ ...answers, [index]: "Custom Message" })}
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#D4AF37" }}
                          />
                          Custom Message...
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
                              border: "2px solid #D4AF37",
                              background: "#ffffff",
                              color: "#000000",
                              fontSize: "15px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginTop: "10px",
                              animation: "fadeIn 0.3s ease-out",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginTop: "20px", marginBottom: "15px" }}>
                  <label style={{ display: "block", color: "#374151", fontSize: "14px", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Target AI Model
                  </label>
                  <select
                    value={targetAi}
                    onChange={(e) => setTargetAi(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: "rgba(255, 255, 255, 0.9)",
                      border: "1px solid #D4AF37",
                      borderRadius: "12px",
                      color: "#000000",
                      fontSize: "15px",
                      outline: "none",
                      cursor: "pointer",
                      appearance: "none",
                    }}
                  >
                    <option value="">Universal / No specific model</option>
                    <option value="ChatGPT (GPT-4o/o1)">ChatGPT (GPT-4o/o1)</option>
                    <option value="Claude 3.5 Sonnet/Opus">Claude 3.5 Sonnet/Opus</option>
                    <option value="Gemini 1.5 Pro/Flash">Gemini 1.5 Pro/Flash</option>
                    <option value="Perplexity AI">Perplexity AI</option>
                    <option value="DeepSeek v3/R1">DeepSeek v3/R1</option>
                    <option value="Groq / Llama 3">Groq / Llama 3</option>
                  </select>
                </div>

                <GetStartedButton
                  onClick={handleGenerateFinalPrompt}
                  disabled={loadingPrompt}
                  loading={loadingPrompt}
                  text="Generate Smart Prompt"
                  loadingText="Forging Prompt..."
                  className="mt-3"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {finalPrompt && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              id="smart-prompt-result" 
              style={{ marginTop: "30px" }}
            >
              <div style={{
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                border: "2px solid rgba(212, 175, 55, 0.6)",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 24px",
                  background: "rgba(249, 250, 251, 0.5)",
                  borderBottom: "1px solid #D4AF37",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <ShieldCheck size={20} color="#D4AF37" />
                    <span style={{ color: "#000000", fontWeight: 700 }}>Your Smart Prompt</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={handleScorePrompt}
                      disabled={loadingScore}
                      style={{
                        padding: "8px 18px",
                        background: "#D4AF37",
                        color: "#000000",
                        border: "none",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {loadingScore ? (
                         <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.span>
                      ) : <Zap size={16} />}
                      Score Prompt
                    </button>
                    <button
                      onClick={handleCopy}
                      style={{
                        padding: "8px 18px",
                        background: copied ? "#10b981" : "#000000",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {copied ? <ShieldCheck size={16} /> : <Copy size={16} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={handleCopyMarkdown}
                      style={{
                        padding: "8px 18px",
                        background: "#ffffff",
                        color: "#000000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <FileText size={16} /> Markdown
                    </button>
                  </div>
                </div>

                {finalPrompt.quality_score !== undefined && (
                  <div style={{ 
                    padding: "24px 32px", 
                    background: "rgba(243, 244, 246, 0.5)", 
                    borderBottom: "1px solid #D4AF37" 
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#000000" }}>Quality Audit</h3>
                      <div style={{ 
                        fontSize: "24px", 
                        fontWeight: 800, 
                        color: finalPrompt.quality_score > 80 ? "#10b981" : finalPrompt.quality_score > 60 ? "#D4AF37" : "#ef4444"
                      }}>
                        {finalPrompt.quality_score}/100
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                      {finalPrompt.quality_breakdown && Object.entries(finalPrompt.quality_breakdown).map(([key, val]) => (
                        <div key={key} style={{ background: "rgba(255, 255, 255, 0.6)", padding: "14px", borderRadius: "12px", border: "1px solid rgba(229, 231, 235, 0.5)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>{key}</div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#000000" }}>{val as number}/20</div>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${((val as number) / 20) * 100}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              style={{ 
                                height: "100%", 
                                background: (val as number) > 16 ? "#10b981" : (val as number) > 12 ? "#D4AF37" : "#ef4444",
                                borderRadius: "3px"
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {finalPrompt.quality_feedback && finalPrompt.quality_feedback.length > 0 && (
                      <div style={{ background: "rgba(255, 251, 235, 0.6)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(254, 243, 199, 0.5)" }}>
                        <div style={{ color: "#92400E", fontWeight: 700, fontSize: "13px", marginBottom: "8px", textTransform: "uppercase" }}>Optimization Tips</div>
                        <ul style={{ margin: 0, paddingLeft: "20px", color: "#92400E", fontSize: "14px" }}>
                          {finalPrompt.quality_feedback.map((tip, i) => (
                            <li key={i} style={{ marginBottom: "4px" }}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ padding: "28px 32px" }}>
                  <div className="markdown-content" style={{ color: "#1f2937", fontSize: "15px", lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {finalPrompt.smart_prompt || finalPrompt.final_instruction || finalPrompt.final_prompt || ""}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* AI Enhancement Section */}
                <div style={{ 
                  padding: "24px 32px", 
                  background: "rgba(249, 250, 251, 0.6)", 
                  borderTop: "1px solid #D4AF37" 
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <Sparkles size={20} color="#D4AF37" />
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#000000" }}>Refine with AI</h3>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input
                      type="text"
                      placeholder="e.g. 'Make it more concise' or 'Add more coding examples'..."
                      value={enhanceInstruction}
                      onChange={(e) => setEnhanceInstruction(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: "1px solid #D4AF37",
                        background: "#ffffff",
                        color: "#000000",
                        fontSize: "14px",
                        outline: "none",
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleEnhancePrompt()}
                    />
                    <button
                      onClick={handleEnhancePrompt}
                      disabled={loadingEnhance || !enhanceInstruction.trim()}
                      style={{
                        padding: "12px 24px",
                        background: "#000000",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s"
                      }}
                    >
                      {loadingEnhance ? (
                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.span>
                      ) : <Sparkles size={16} />}
                      {loadingEnhance ? "Enhancing..." : "Enhance"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: "30px",
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(212, 175, 55, 0.5)",
                borderRadius: "24px",
                padding: "32px",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <Play size={24} fill="#000000" />
                  <h2 style={{ color: "#000000", margin: 0, fontSize: "22px", fontWeight: 700 }}>🧪 Test Prompt</h2>
                </div>
                <button
                  onClick={handleTestPrompt}
                  disabled={loadingTest}
                  style={{
                    padding: "14px 28px",
                    background: "#000000",
                    color: "#ffffff",
                    borderRadius: "12px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                >
                  {loadingTest ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.span>
                      AI is thinking...
                    </>
                  ) : "Test Instantly"}
                </button>
                
                {testResponse && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    id="test-response-container" 
                    style={{ 
                      marginTop: "24px", 
                      padding: "20px",
                      background: "rgba(249, 250, 251, 0.6)",
                      borderRadius: "16px",
                      border: "1px dashed #D4AF37",
                      color: "#374151",
                      lineHeight: 1.6,
                      fontSize: "15px"
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#D4AF37", marginBottom: "10px", fontSize: "13px", textTransform: "uppercase" }}>AI Response</div>
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {testResponse}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
    
      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
                zIndex: 200,
              }}
            />
            {/* Sidebar */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                width: "100%",
                maxWidth: "400px",
                height: "100%",
                background: "#ffffff",
                zIndex: 201,
                boxShadow: "-10px 0 30px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div style={{ padding: "24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Clock size={22} color="#D4AF37" />
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Prompt History</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  style={{ background: "#f3f4f6", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>📜</div>
                    <p>No prompts generated yet. Start building to see your history!</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {history.map((item) => (
                      <div 
                        key={item.id}
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "16px",
                          padding: "16px",
                          position: "relative",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#D4AF37", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase" }}>
                          {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <p style={{ 
                          fontSize: "14px", 
                          fontWeight: 600, 
                          color: "#1f2937", 
                          margin: "0 0 12px 0",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {item.user_idea}
                        </p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => {
                              setFinalPrompt(item);
                              setShowHistory(false);
                              setTimeout(() => {
                                document.getElementById("smart-prompt-result")?.scrollIntoView({ behavior: "smooth" });
                              }, 100);
                            }}
                            style={{
                              flex: 1,
                              padding: "8px",
                              background: "#000000",
                              color: "#ffffff",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              border: "none"
                            }}
                          >
                            View Prompt
                          </button>
                          <button
                            onClick={() => {
                              if(confirm("Delete this prompt?")) {
                                const newHist = history.filter(h => h.id !== item.id);
                                setHistory(newHist);
                                localStorage.setItem("promptHistory", JSON.stringify(newHist));
                              }
                            }}
                            style={{
                              padding: "8px",
                              background: "#fee2e2",
                              color: "#ef4444",
                              borderRadius: "8px",
                              border: "none",
                              cursor: "pointer"
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                  <button
                    onClick={() => {
                      if(confirm("Clear your entire history?")) {
                        setHistory([]);
                        localStorage.removeItem("promptHistory");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "#f3f4f6",
                      color: "#ef4444",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <Trash2 size={16} /> Clear All History
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
          z-index: 1;
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
          fill: rgba(255, 222, 77, 0.4);
        }
        .parallax > use:nth-child(2) {
          animation-delay: -3s;
          animation-duration: 10s;
          fill: rgba(255, 178, 44, 0.3);
        }
        .parallax > use:nth-child(3) {
          animation-delay: -4s;
          animation-duration: 13s;
          fill: rgba(248, 222, 34, 0.2);
        }
        .parallax > use:nth-child(4) {
          animation-delay: -5s;
          animation-duration: 20s;
          fill: rgba(243, 243, 243, 0.8);
        }
        @keyframes move-forever {
          0% {
           transform: translate3d(-90px,0,0);
          }
          100% { 
            transform: translate3d(85px,0,0);
          }
        }

        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          color: #000000;
          margin-top: 24px;
          margin-bottom: 12px;
          font-weight: 800;
        }
        .markdown-content h1 { font-size: 1.5rem; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; }
        .markdown-content h2 { font-size: 1.25rem; }
        .markdown-content h3 { font-size: 1.1rem; }
        .markdown-content p { margin-bottom: 16px; line-height: 1.8; }
        .markdown-content code {
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.9em;
          color: #D4AF37;
        }
        .markdown-content pre {
          background: #000000;
          color: #ffffff;
          padding: 20px;
          border-radius: 12px;
          overflow-x: auto;
          margin-bottom: 20px;
          border-left: 4px solid #D4AF37;
        }
        .markdown-content pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }
        .markdown-content ul, .markdown-content ol {
          margin-bottom: 16px;
          padding-left: 24px;
        }
        .markdown-content li {
          margin-bottom: 8px;
        }
        .markdown-content blockquote {
          border-left: 4px solid #D4AF37;
          padding-left: 16px;
          font-style: italic;
          color: #6b7280;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
