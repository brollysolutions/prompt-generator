"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Copy, Play, Sparkles, User, Settings, LogOut, Key, Save, Edit2, X, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GetStartedButton } from "@/components/ui/get-started-button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/context/AuthContext";

const PROVIDER_MODELS: Record<string, string[]> = {
  "GroqCloud": ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  "Claude": ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  "OpenAI(chat gpt)": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  "Google Gemini": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  "Cohere Dashboard": ["command-r-plus", "command-r"],
  "Perplexity API": ["llama-3-sonar-large-32k-online", "llama-3-sonar-small-32k-online"],
  "Hugging Face Inference Provider": ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"]
};

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
  const { user, loading: authLoading, logout } = useAuth();
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string | string[] }>({});
  const [customAnswers, setCustomAnswers] = useState<{ [key: number]: string }>({});
  const [finalPrompt, setFinalPrompt] = useState<SmartPromptResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetAi, setTargetAi] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [internalPrompt, setInternalPrompt] = useState<string>("");

  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPromptBuffer, setEditPromptBuffer] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsApiKey, setSettingsApiKey] = useState("");
  const [settingsApiProvider, setSettingsApiProvider] = useState("");
  const [settingsApiModel, setSettingsApiModel] = useState("");
  const [isEditingSettingsKey, setIsEditingSettingsKey] = useState(false);

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

  // Load from localStorage on mount
  useEffect(() => {
    const hydrate = () => {
      let sId = localStorage.getItem("sessionId");
      if (!sId) {
        sId = "session_" + Date.now();
        localStorage.setItem("sessionId", sId);
      }
      setSessionId(sId);

      const savedUserInput = localStorage.getItem("userInput");
      const savedQuestions = localStorage.getItem("questions");
      const savedAnswers = localStorage.getItem("answers");
      const savedCustomAnswers = localStorage.getItem("customAnswers");
      const savedFinalPrompt = localStorage.getItem("finalPrompt");
      const savedTargetAi = localStorage.getItem("targetAi");
      const savedTestResponse = localStorage.getItem("testResponse");
      const savedInternalPrompt = localStorage.getItem("internalPrompt");

      if (savedUserInput) setUserInput(savedUserInput);
      if (savedQuestions) setQuestions(JSON.parse(savedQuestions));
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      if (savedCustomAnswers) setCustomAnswers(JSON.parse(savedCustomAnswers));
      if (savedFinalPrompt) setFinalPrompt(JSON.parse(savedFinalPrompt));
      if (savedTargetAi) setTargetAi(savedTargetAi);
      if (savedTestResponse) setTestResponse(savedTestResponse);
      if (savedInternalPrompt) setInternalPrompt(savedInternalPrompt);
    };

    hydrate();
  }, []);

  // Save to localStorage whenever state changes - MOVED ABOVE EARLY RETURNS
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

  useEffect(() => {
    if (internalPrompt) localStorage.setItem("internalPrompt", internalPrompt);
  }, [internalPrompt]);

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/test-prompt`, {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: userInput }),
      });
      const data = await response.json();
      setQuestions(data.questions || []);
      setInternalPrompt(data.internal_prompt || "");
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
      setShowDetails(false); // Reset show details on new generation

      const processedAnswers: { [key: number]: string } = {};
      Object.keys(answers).forEach((key) => {
        const idx = parseInt(key);
        const value = answers[idx];
        
        // Handle array-based answers (checkboxes)
        if (Array.isArray(value)) {
          const customText = customAnswers[idx];
          const hasCustom = value.includes("Custom Message");
          const filtered = value.filter(v => v !== "Custom Message");
          
          if (hasCustom && customText && customText.trim()) {
            filtered.push(customText.trim());
          }
          
          processedAnswers[idx] = filtered.join(", ");
        } else if (typeof value === "string") {
          // Handle string-based answers (radio/text/dropdown - if any remain)
          const customText = customAnswers[idx];
          if (value === "Custom Message" && customText && customText.trim()) {
            processedAnswers[idx] = customText.trim();
          } else {
            processedAnswers[idx] = value;
          }
        }
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-final-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: userInput,
          answers: processedAnswers,
          questions,
          target_ai: targetAi,
          internal_prompt: internalPrompt,
        }),
      });
      const data = await response.json();
      
      const promptText = data.smart_prompt || data.final_instruction || data.final_prompt || "";

      // Save to history
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            prompt_text: promptText,
            source: "generated",
          }),
        });
      } catch (historyError) {
        console.error("Failed to save to history:", historyError);
      }

      // Auto-score the generated prompt
      try {
        const scoreResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/score-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptText }),
        });
        const fullScoreData = await scoreResponse.json();
        const scoreData = {
          quality_score: fullScoreData.score,
          quality_breakdown: fullScoreData.criteria,
          quality_feedback: fullScoreData.suggestions,
          rewritten_prompt: fullScoreData.rewritten_prompt
        };

        // Ensure score data is correctly mapped if coming from initial generation
        const finalData = {
          ...data,
          ...scoreData,
          id: Date.now(),
          timestamp: new Date().toISOString(),
          user_idea: userInput,
        };
        
        setFinalPrompt(finalData);
        localStorage.setItem("finalPrompt", JSON.stringify(finalData));
      } catch (scoreError) {
        console.error("Failed to auto-score prompt:", scoreError);
        const finalData = {
          ...data,
          id: Date.now(),
          timestamp: new Date().toISOString(),
          user_idea: userInput,
        };
        setFinalPrompt(finalData);
        localStorage.setItem("finalPrompt", JSON.stringify(finalData));
      }
      
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
    const markdownText = "```markdown\n" + text + "\n```";
    navigator.clipboard.writeText(markdownText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSavePromptEdit = async () => {
    if (!finalPrompt || !editPromptBuffer.trim()) return;
    
    const updatedPrompt = {
      ...finalPrompt,
      smart_prompt: editPromptBuffer,
      final_instruction: undefined,
      final_prompt: undefined
    };
    
    setFinalPrompt(updatedPrompt);
    localStorage.setItem("finalPrompt", JSON.stringify(updatedPrompt));
    setIsEditingPrompt(false);
    
    // Save to history
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          prompt_text: editPromptBuffer,
          source: "edited (live)",
        }),
      });
    } catch (historyError) {
      console.error("Failed to save edited prompt to history:", historyError);
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
                <button
                  onClick={() => {
                    const token = localStorage.getItem("auth_token");
                    const user = localStorage.getItem("auth_user");
                    const sessionId = localStorage.getItem("sessionId");
                    localStorage.clear();
                    if (token) localStorage.setItem("auth_token", token);
                    if (user) localStorage.setItem("auth_user", user);
                    if (sessionId) localStorage.setItem("sessionId", sessionId);
                    window.location.reload();
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    background: "#000000",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer"
                  }}
                >
                  Reset
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px",
                      background: "rgba(212, 175, 55, 0.1)",
                      border: "1px solid #D4AF37",
                      borderRadius: "50%",
                      cursor: "pointer",
                      color: "#AA8A27"
                    }}
                  >
                    <User size={18} />
                  </button>
                  {isProfileOpen && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "8px",
                      background: "#fff",
                      border: "1px solid #eaeaea",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      minWidth: "120px",
                      zIndex: 101
                    }}>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          setIsSettingsOpen(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#333",
                          textAlign: "left",
                          borderBottom: "1px solid #eaeaea"
                        }}
                      >
                        <Settings size={16} /> Settings
                      </button>
                      <button
                        onClick={logout}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#e11d48",
                          textAlign: "left"
                        }}
                      >
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
                              const current = Array.isArray(answers[index]) ? answers[index] : [];
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
                                        : current.filter((x: string) => x !== option);
                                      setAnswers({ ...answers, [index]: updated });
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
                                checked={Array.isArray(answers[index]) && answers[index].includes("Custom Message")}
                                onChange={(e) => {
                                  const current = Array.isArray(answers[index]) ? answers[index] : [];
                                  const updated = e.target.checked
                                    ? [...current, "Custom Message"]
                                    : current.filter((x: string) => x !== "Custom Message");
                                  setAnswers({ ...answers, [index]: updated });
                                }}
                                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#D4AF37" }}
                              />
                              Custom Message...
                            </label>

                            {Array.isArray(answers[index]) && answers[index].includes("Custom Message") && (
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
                    background: "#F3F4F4",
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
                        {!isEditingPrompt ? (
                          <>
                            <button
                              onClick={() => {
                                const text = finalPrompt.smart_prompt || finalPrompt.final_instruction || finalPrompt.final_prompt || "";
                                setEditPromptBuffer(text);
                                setIsEditingPrompt(true);
                              }}
                              style={{
                                padding: "8px 18px",
                                background: "rgba(255, 255, 255, 0.8)",
                                border: "1px solid #D4AF37",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontWeight: 600,
                                color: "#AA8A27",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <Sparkles size={16} /> Edit
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
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleSavePromptEdit}
                              style={{
                                padding: "8px 18px",
                                background: "#000000",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setIsEditingPrompt(false)}
                              style={{
                                padding: "8px 18px",
                                background: "#f3f4f6",
                                color: "#4b5563",
                                border: "1px solid #e5e7eb",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {finalPrompt.quality_score !== undefined && (
                      <div style={{ 
                        padding: "24px 32px", 
                        background: "rgba(243, 244, 246, 0.5)", 
                        borderBottom: "1px solid #D4AF37" 
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#000000" }}>Quality Audit</h3>
                            <button 
                              onClick={() => setShowDetails(!showDetails)}
                              style={{
                                background: "none",
                                border: "1px solid #D4AF37",
                                color: "#D4AF37",
                                padding: "4px 12px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                            >
                              {showDetails ? "Hide Details" : "View Details"}
                            </button>
                          </div>
                          <div style={{ 
                            fontSize: "24px", 
                            fontWeight: 800, 
                            color: finalPrompt.quality_score > 80 ? "#10b981" : finalPrompt.quality_score > 60 ? "#D4AF37" : "#ef4444"
                          }}>
                            {finalPrompt.quality_score}/100
                          </div>
                        </div>

                        <AnimatePresence>
                          {showDetails && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: "hidden" }}
                            >
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
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div style={{ padding: "28px 32px" }}>
                      {isEditingPrompt ? (
                        <textarea
                          value={editPromptBuffer}
                          onChange={(e) => setEditPromptBuffer(e.target.value)}
                          style={{
                            width: "100%",
                            height: "400px",
                            padding: "20px",
                            borderRadius: "16px",
                            border: "2px solid #D4AF37",
                            background: "rgba(255, 255, 255, 0.9)",
                            color: "#000000",
                            fontSize: "15px",
                            lineHeight: "1.7",
                            fontFamily: "inherit",
                            outline: "none",
                            resize: "vertical",
                          }}
                        />
                      ) : (
                        <div className="markdown-content" style={{ color: "#1f2937", fontSize: "15px", lineHeight: 1.7 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {"```markdown\n" + (finalPrompt.smart_prompt || finalPrompt.final_instruction || finalPrompt.final_prompt || "") + "\n```"}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* IN-APP PROMPT TESTER DISABLED FOR LIVE TESTING
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
                      <h2 style={{ color: "#000000", margin: 0, fontSize: "22px", fontWeight: 700 }}>Test Prompt</h2>
                    </div>
                    <GetStartedButton
                      onClick={handleTestPrompt}
                      loading={loadingTest}
                      text="Test Prompt"
                    />
                    
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
                  */}
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </>
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
            style={{
              background: "#ffffff",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              borderRadius: "24px",
              padding: "32px",
              width: "100%",
              maxWidth: "450px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
              position: "relative"
            }}
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
                        {settingsApiProvider && PROVIDER_MODELS[settingsApiProvider].map(m => (
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
                background: "#F3F4G6",
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
          background: #F3F4F4;
          color: #000000;
          padding: 20px;
          border-radius: 12px;
          white-space: pre-wrap;
          word-wrap: break-word;
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
