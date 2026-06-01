"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { GradientButton } from "@/components/ui/gradient-button";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F3F3F3",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative"
    }}>
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

      <div className="relative z-50 flex flex-col items-center px-5 text-center">
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 1,
            ease: "easeOut",
          }}
          style={{ fontFamily: "'Merriweather', serif", fontWeight: 400, width: "250%" }}
          className="bg-gradient-to-r from-[#D4AF37] via-[#AA8A27] to-[#D4AF37] bg-[length:200%_auto] animate-shimmer py-4 bg-clip-text text-4xl tracking-normal text-transparent md:text-7xl"
        >
          Smart Prompt <br /> Generator
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.5,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="mt-6 flex flex-col items-center gap-6"
        >
          <p className="max-w-2xl text-[#8A7322] text-xl md:text-2xl font-medium drop-shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            Describe your idea → Answer AI questions → Get a professional, copy-ready prompt for any AI tool.
          </p>
          <div className="mt-8">
            <GradientButton />
          </div>
        </motion.div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&display=swap');
        * { box-sizing: border-box; }
        
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }

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
          animation-duration: 100vh;
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
          fill: #F3F3F3;
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
