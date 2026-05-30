import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface GetStartedButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  text?: string;
  loadingText?: string;
  className?: string;
}

export function GetStartedButton({ onClick, disabled, loading, text = "Get Started", loadingText = "Analyzing...", className }: GetStartedButtonProps) {
  return (
    <Button 
      className={`group relative overflow-hidden bg-black text-white hover:bg-black/90 ${className}`} 
      size="lg"
      onClick={onClick}
      disabled={disabled || loading}
    >
      <span className={`mr-8 transition-opacity duration-500 ${loading ? "opacity-0" : "group-hover:opacity-0"}`}>
        {loading ? loadingText : text}
      </span>
      <i className="absolute right-1 top-1 bottom-1 rounded-sm z-10 grid w-1/4 place-items-center transition-all duration-500 bg-primary-foreground/15 group-hover:w-[calc(100%-0.5rem)] group-active:scale-95 text-white">
        {loading ? (
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.span>
        ) : (
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        )}
      </i>
    </Button>
  );
}
