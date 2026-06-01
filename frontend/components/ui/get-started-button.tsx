import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GetStartedButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  text?: string;
  className?: string;
}

export function GetStartedButton({ 
  onClick, 
  disabled, 
  loading, 
  text = "Get Started",
  className 
}: GetStartedButtonProps) {
  return (
    <Button 
      className={cn("group relative overflow-hidden", className)} 
      size="lg"
      onClick={onClick}
      disabled={disabled || loading}
    >
      <span className={cn(
        "mr-8 transition-opacity duration-500",
        !loading && "group-hover:opacity-0"
      )}>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        ) : text}
      </span>
      <i className="absolute right-1 top-1 bottom-1 rounded-sm z-10 grid w-1/4 place-items-center transition-all duration-500 bg-primary-foreground/15 group-hover:w-[calc(100%-0.5rem)] group-active:scale-95 text-white">
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </i>
    </Button>
  );
}
