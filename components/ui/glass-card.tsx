import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/utils";

type Radius = "tile" | "card" | "lg" | "dialog";

const RADIUS: Record<Radius, string> = {
  tile: "var(--r-tile)",
  card: "var(--r-card-lg)",
  lg: "var(--r-card-lg)",
  dialog: "var(--r-dialog)",
};

type GlassCardProps<T extends ElementType> = {
  as?: T;
  /** Nested tile: flat translucent fill, no blur (use inside another glass surface). */
  inner?: boolean;
  /** Hover lift (-3px). */
  lift?: boolean;
  radius?: Radius;
  /** Padding in px. Default 20. */
  padding?: number;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "padding">;

export function GlassCard<T extends ElementType = "div">({
  as,
  inner = false,
  lift = false,
  radius,
  padding = 20,
  className,
  style,
  ...rest
}: GlassCardProps<T>) {
  const Tag: ElementType = as ?? "div";
  const r = radius ?? (inner ? "tile" : "card");
  return (
    <Tag
      className={cn(inner ? "glass-inner" : "glass", lift && "lift", className)}
      style={{ borderRadius: RADIUS[r], padding, ...(style as object) }}
      {...rest}
    />
  );
}
