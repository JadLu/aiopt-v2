import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipProps {
  children: ReactNode;
  /** Selected state (rendered via aria-pressed). Only meaningful with onClick. */
  pressed?: boolean;
  /** Makes the chip a toggle button. Without it the chip is a static label. */
  onClick?: () => void;
  /** Adds a remove (×) button next to the label. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Use "rtl" for Arabic options; also applies the Cairo font. */
  dir?: "ltr" | "rtl" | "auto";
  className?: string;
}

export function Chip({
  children,
  pressed,
  onClick,
  onRemove,
  removeLabel = "Remove",
  dir,
  className,
}: ChipProps) {
  const classes = cn("chip", dir === "rtl" && "font-arabic", className);

  if (onClick) {
    return (
      <button type="button" className={classes} aria-pressed={!!pressed} dir={dir} onClick={onClick}>
        {children}
      </button>
    );
  }

  return (
    <span className={classes} dir={dir}>
      {children}
      {onRemove && (
        <button type="button" className="chip-remove" aria-label={removeLabel} onClick={onRemove}>
          <X size={12} aria-hidden />
        </button>
      )}
    </span>
  );
}
