"use client";

import { useState } from "react";
import { X, Link as LinkIcon, Check, Globe, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { copyToClipboard } from "@/lib/clipboard";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
  qualityScore: number;
  category: string;
  language: string;
  token: string | null; // JWT auth token
}

export default function ShareDialog({
  isOpen,
  onClose,
  promptText,
  qualityScore,
  category,
  language,
  token
}: ShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState("public");
  const [expiresIn, setExpiresIn] = useState<string>("");

  const handleGenerateLink = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/prompts/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt_text: promptText,
          quality_score: qualityScore || 0,
          category: category || "General",
          language: language || "English",
          visibility: visibility,
          expires_in_days: expiresIn ? parseInt(expiresIn) : null
        })
      });
      const data = await response.json();
      if (response.ok) {
        // Construct full URL based on current window location
        const baseUrl = window.location.origin;
        setShareUrl(`${baseUrl}${data.share_url}`);
      } else {
        alert("Failed to generate share link");
      }
    } catch (error) {
      console.error(error);
      alert("Error generating share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      copyToClipboard(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Reset state when closed
  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white border border-[#D4AF37]/30 rounded-[24px] p-6 md:p-8 w-full max-w-[450px] shadow-2xl relative"
          >
            <button
              onClick={handleClose}
              style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-xl flex items-center justify-center mx-auto mb-4 text-[#AA8A27]">
                <LinkIcon size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 m-0">Share Prompt</h2>
              <p className="text-gray-500 text-sm mt-1">Anyone with the link can view and save this prompt.</p>
            </div>

            {!shareUrl ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Visibility</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisibility("public")}
                      className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${visibility === "public" ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#AA8A27]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      <Globe size={16} /> Public
                    </button>
                    <button
                      onClick={() => setVisibility("unlisted")}
                      className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${visibility === "unlisted" ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#AA8A27]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      <Lock size={16} /> Unlisted
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Expiration</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#D4AF37] outline-none"
                  >
                    <option value="">Never expires</option>
                    <option value="7">Expires in 7 days</option>
                    <option value="30">Expires in 30 days</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="w-full py-3.5 bg-black text-white rounded-xl font-bold mt-4 hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Link"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="bg-transparent border-none outline-none flex-1 text-sm text-gray-600 font-medium"
                  />
                  <button
                    onClick={handleCopy}
                    className={`p-2 rounded-lg transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-black text-white hover:bg-gray-800"}`}
                  >
                    {copied ? <Check size={18} /> : <LinkIcon size={18} />}
                  </button>
                </div>
                {copied && <p className="text-center text-xs font-medium text-green-600">Link copied to clipboard!</p>}
                
                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold mt-2 hover:bg-gray-200 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
