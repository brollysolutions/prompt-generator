"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { User, ShieldCheck, Eye, Download, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { copyToClipboard } from "@/lib/clipboard";

type SharedPrompt = {
  prompt_text: string;
  quality_score: number;
  category: string;
  language: string;
  author_name: string;
  created_at: string;
  view_count: number;
};

export default function SharePage() {
  const { token } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [prompt, setPrompt] = useState<SharedPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchPrompt = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/share/${token}`);
        if (response.ok) {
          const data = await response.json();
          setPrompt(data);
        } else if (response.status === 410) {
          setError("This link has expired or has been revoked by the owner.");
        } else {
          setError("This link is invalid or no longer exists.");
        }
      } catch (err) {
        setError("Failed to connect to the server.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrompt();
  }, [token]);

  const handleSave = async () => {
    if (!user) {
      // Redirect to login if not authenticated
      alert("You need to be logged in to save this prompt.");
      router.push("/login");
      return;
    }
    
    setSaveStatus("saving");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/share/${token}/save`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        }
      });
      
      if (response.ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      setSaveStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 bg-gray-50">
        Loading...
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 font-bold text-2xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => router.push("/")}
            className="mt-6 w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Animated Wave Background */}
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

      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-[800px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <h1 className="font-bold text-xl tracking-tight text-gray-900">
            Prompt Generator
          </h1>
          <div className="flex gap-4 items-center">
            {authLoading ? null : user ? (
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                Logged in as {user.email.split('@')[0]}
              </span>
            ) : (
              <button 
                onClick={() => router.push("/login")}
                className="text-sm font-bold text-gray-700 hover:text-black flex items-center gap-2"
              >
                <LogIn size={16} /> Log in
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[800px] mx-auto px-4 py-12 relative z-10">
        
        <div className="text-center mb-8">
          <span className="px-3 py-1 bg-white border border-[#D4AF37]/30 text-[#AA8A27] text-xs font-bold uppercase rounded-full shadow-sm mb-4 inline-block">
            Shared Prompt
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            A prompt shared by {prompt.author_name}
          </h1>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-3xl p-6 md:p-10 mb-8">
          <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
              {prompt.category}
            </div>
            
            {prompt.quality_score > 0 && (
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <ShieldCheck size={16} className="text-[#10b981]" />
                Score: {prompt.quality_score}/100
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <Eye size={16} className="text-blue-500" />
              {prompt.view_count} views
            </div>
          </div>

          <div className="bg-[#f8f9fa] rounded-2xl p-6 md:p-8 font-mono text-sm md:text-base text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-200">
            {prompt.prompt_text}
          </div>
          
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => {
                if (prompt) {
                  copyToClipboard(prompt.prompt_text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }
              }}
              className="w-full sm:w-auto flex-1 py-3.5 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
              className={`w-full sm:w-auto flex-[2] py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                saveStatus === "saved" ? "bg-[#10b981]" : "bg-black hover:bg-gray-800"
              }`}
            >
              <Download size={18} />
              {saveStatus === "saved" ? "Saved to your Library!" : saveStatus === "saving" ? "Saving..." : "Save to my Library"}
            </button>
          </div>
          {saveStatus === "error" && <p className="text-red-500 text-sm font-medium mt-3 text-center">Failed to save prompt. Please try again.</p>}
        </div>
      </main>

      <style>{`
        .bg-wave-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: #F3F3F3; overflow: hidden; }
        .waves { position: absolute; bottom: 0; width: 100%; height: 100vh; min-height: 100vh; }
        .parallax > use { animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite; }
        .parallax > use:nth-child(1) { animation-delay: -2s; animation-duration: 7s; fill: rgba(244, 206, 20, 0.4); }
        .parallax > use:nth-child(2) { animation-delay: -3s; animation-duration: 10s; fill: rgba(244, 206, 20, 0.3); }
        .parallax > use:nth-child(3) { animation-delay: -4s; animation-duration: 13s; fill: rgba(244, 206, 20, 0.2); }
        .parallax > use:nth-child(4) { animation-delay: -5s; animation-duration: 20s; fill: #F3F3F3; }
        @keyframes move-forever { 0% { transform: translate3d(-90px,0,0); } 100% { transform: translate3d(85px,0,0); } }
      `}</style>
    </div>
  );
}
