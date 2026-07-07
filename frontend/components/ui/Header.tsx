"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, LogOut, Menu, X, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header({ showReset = false, onOpenSettings }: { showReset?: boolean; onOpenSettings?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-[#D4AF37] px-4 py-3 md:px-6 md:py-4 sticky top-0 z-[100] shadow-sm w-full box-border relative">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between w-full">
        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex items-center justify-center p-2 text-black shrink-0 cursor-pointer"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 md:justify-end pr-4 min-w-0">
          <Link href="/generator" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0">Generator</Link>
          <Link href="/templates" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0">Templates</Link>
          <Link href="/library" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0">Library</Link>
          <Link href="/history" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0">History</Link>
          <Link href="/community" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0">Community</Link>
          <Link href="/analytics" className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black rounded-[8px] md:rounded-[10px] no-underline shrink-0 relative flex items-center">
            Analytics <span className="ml-1.5 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm shadow-sm border border-white/20 tracking-wider">PRO</span>
          </Link>
          {showReset && (
            <button
              onClick={() => {
                const keysToRemove = ["userInput", "questions", "answers", "customAnswers", "finalPrompt", "targetAi", "testResponse", "internalPrompt"];
                keysToRemove.forEach(key => localStorage.removeItem(key));
                window.location.reload();
              }}
              className="px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] sm:text-xs md:text-[13px] font-semibold text-white bg-black border-none rounded-[8px] md:rounded-[10px] cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative shrink-0 ml-auto md:ml-4 md:border-l md:border-gray-200 pl-2 md:pl-4">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center justify-center p-2 bg-[#D4AF37]/10 border border-[#D4AF37] rounded-full cursor-pointer text-[#AA8A27] shrink-0"
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
              minWidth: "140px",
              zIndex: 101
            }}>
              {onOpenSettings && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenSettings();
                  }}
                  className="flex items-center w-full px-4 py-3 text-left text-[13px] text-gray-700 hover:bg-gray-50 transition-colors bg-transparent border-none border-b border-gray-100 cursor-pointer"
                >
                  <Settings size={14} className="mr-2" />
                  Settings
                </button>
              )}
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  logout();
                  router.push("/");
                }}
                className="flex items-center w-full px-4 py-3 text-left text-[13px] text-red-600 hover:bg-red-50 transition-colors bg-transparent border-none cursor-pointer"
              >
                <LogOut size={14} className="mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-col p-2 z-[99]">
          <Link href="/generator" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>Generator</Link>
          <Link href="/templates" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>Templates</Link>
          <Link href="/library" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>Library</Link>
          <Link href="/history" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>History</Link>
          <Link href="/community" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>Community</Link>
          <Link href="/analytics" className="px-4 py-3 text-[14px] font-medium text-black hover:bg-gray-50 text-left no-underline flex items-center justify-between border-b border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>
            <span>Analytics</span> <span className="bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm shadow-sm border border-white/20 tracking-wider">PRO</span>
          </Link>
          {showReset && (
            <button
              onClick={() => {
                const keysToRemove = ["userInput", "questions", "answers", "customAnswers", "finalPrompt", "targetAi", "testResponse", "internalPrompt"];
                keysToRemove.forEach(key => localStorage.removeItem(key));
                setIsMobileMenuOpen(false);
                window.location.reload();
              }}
              className="px-4 py-3 text-[14px] font-medium text-red-600 hover:bg-red-50 text-left bg-transparent border-none cursor-pointer w-full text-left"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
