"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

interface Props {
  cost: number;
  children: React.ReactNode;
}

export function CreditTooltip({ cost, children }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            padding: "5px 10px",
            borderRadius: "var(--r-input)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--card-shadow)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-primary)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "none",
            zIndex: 300,
          }}
        >
          <Zap size={11} />
          {cost} credits
          {/* Arrow */}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid var(--border-default)",
            }}
          />
        </div>
      )}
    </div>
  );
}
