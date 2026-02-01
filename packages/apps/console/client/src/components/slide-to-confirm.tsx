import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";

interface SlideToConfirmProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  variant?: "default" | "critical";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function SlideToConfirm({
  onConfirm,
  label = "Slide to Confirm",
  confirmLabel = "Confirmed",
  variant = "default",
  disabled = false,
  loading = false,
  className,
}: SlideToConfirmProps) {
  const [slideProgress, setSlideProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const maxSlideRef = useRef(0);

  const handleStart = (clientX: number) => {
    if (disabled || loading || confirmed) return;
    setIsDragging(true);
    startXRef.current = clientX;
    if (containerRef.current) {
      maxSlideRef.current = containerRef.current.offsetWidth - 48;
    }
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || loading || confirmed) return;
    const delta = clientX - startXRef.current;
    const progress = Math.min(Math.max(0, delta), maxSlideRef.current);
    const percentage = (progress / maxSlideRef.current) * 100;
    setSlideProgress(percentage);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (slideProgress >= 95 && !confirmed && !loading) {
      setConfirmed(true);
      setSlideProgress(100);
      onConfirm();
    } else if (!confirmed) {
      setSlideProgress(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const variantStyles = {
    default: {
      track: "bg-muted",
      thumb: "bg-primary",
      thumbActive: "bg-primary/90",
      text: "text-muted-foreground",
      fill: "bg-primary/20",
    },
    critical: {
      track: "bg-status-critical/10",
      thumb: "bg-status-critical",
      thumbActive: "bg-status-critical/90",
      text: "text-status-critical",
      fill: "bg-status-critical/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-12 rounded-lg overflow-hidden select-none touch-none",
        styles.track,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      data-testid="slide-to-confirm"
    >
      <div
        className={cn("absolute inset-y-0 left-0 transition-all", styles.fill)}
        style={{ width: `${slideProgress}%` }}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={cn("text-sm font-medium", styles.text)}>
          {confirmed ? confirmLabel : label}
        </span>
      </div>

      {!confirmed && !loading && (
        <div
          className={cn(
            "absolute top-1 left-1 bottom-1 w-10 rounded-md flex items-center justify-center cursor-grab active:cursor-grabbing transition-all",
            isDragging ? styles.thumbActive : styles.thumb
          )}
          style={{
            transform: `translateX(${(slideProgress / 100) * maxSlideRef.current}px)`,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          data-testid="slide-thumb"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className={cn("h-5 w-5 animate-spin", styles.text)} />
        </div>
      )}
    </div>
  );
}
