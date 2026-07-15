"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc] px-4 font-sans text-gray-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-400 to-red-500" />
        
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-sm border border-red-100">
          <AlertTriangle size={36} strokeWidth={1.5} />
        </div>

        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          We encountered an unexpected error. Don&apos;t worry, our team has been notified. 
          You can try again or return to the homepage.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            <RefreshCw size={18} />
            Try again
          </button>
          
          <Link 
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
          >
            <Home size={18} />
            Go Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
