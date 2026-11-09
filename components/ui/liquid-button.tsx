import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Common = {
  icon?: ReactNode;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
};

// Icon-only buttons (no children) must carry an accessible name.
type LiquidButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  ({ children: ReactNode } | { children?: undefined; "aria-label": string });

/** Primary action. Use at most ONE per screen. */
export function LiquidButton({
  icon,
  loading = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: LiquidButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn-liquid", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}
