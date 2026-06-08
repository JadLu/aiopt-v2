"use client";

import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { MessageCircle, X, Send, Bot, User, Loader } from "lucide-react";
import type { MetaCampaign } from "@/lib/firebase/meta-campaigns";
import type { AdAlert } from "@/lib/firebase/ad-alerts";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  campaigns: MetaCampaign[];
  alerts: AdAlert[];
}

export function AiChat({ campaigns, alerts }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi! I'm your Meta Ads AI assistant. I can see your live campaign data and help you optimize performance, diagnose issues, or plan your next move. What would you like to work on?",
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function buildContext() {
    if (campaigns.length === 0) return null;
    const active = campaigns.filter((c) => c.status === "ACTIVE");
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const avgRoas =
      campaigns.length > 0
        ? campaigns.reduce((s, c) => s + c.roas, 0) / campaigns.length
        : 0;
    return {
      totalSpend,
      avgRoas,
      activeCampaigns: active.length,
      openAlerts: alerts.length,
      campaigns: campaigns.map((c) => ({
        name: c.name,
        status: c.status,
        spend: c.spend,
        roas: c.roas,
        cpa: c.cpa,
        ctr: c.ctr,
        frequency: c.frequency,
        healthTier: c.healthTier,
        healthScore: c.healthScore,
      })),
    };
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages([...nextMessages, assistantPlaceholder]);

    try {
      const res = await authFetch("/api/advertising/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          context: buildContext(),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([
          ...nextMessages,
          { role: "assistant", content: accumulated },
        ]);
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 1000,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--accent-primary)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(90,200,214,0.4)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
        title="AI Ad Assistant"
      >
        {open ? (
          <X size={20} color="#fff" />
        ) : (
          <MessageCircle size={22} color="#fff" />
        )}
        {!open && alerts.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg-base)",
            }}
          >
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            right: 28,
            zIndex: 999,
            width: 380,
            height: 520,
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg-subtle)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                AI Ad Assistant
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {campaigns.length > 0
                  ? `Watching ${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}`
                  : "No campaigns loaded"}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} streaming={streaming && i === messages.length - 1 && msg.role === "assistant"} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 14px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              background: "var(--bg-subtle)",
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your campaigns…"
              rows={1}
              disabled={streaming}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                outline: "none",
                lineHeight: 1.4,
                maxHeight: 100,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: input.trim() && !streaming ? "var(--accent-primary)" : "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                cursor: input.trim() && !streaming ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {streaming ? (
                <Loader size={14} style={{ color: "var(--text-tertiary)", animation: "spin 1s linear infinite" }} />
              ) : (
                <Send size={14} color={input.trim() ? "#fff" : "var(--text-tertiary)"} />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isUser
            ? "var(--accent-secondary)"
            : "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isUser ? <User size={13} color="#fff" /> : <Bot size={13} color="#fff" />}
      </div>

      <div
        style={{
          maxWidth: "82%",
          padding: "9px 12px",
          borderRadius: isUser
            ? "14px 4px 14px 14px"
            : "4px 14px 14px 14px",
          background: isUser ? "var(--accent-primary)" : "var(--bg-subtle)",
          color: isUser ? "#fff" : "var(--text-primary)",
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.content || (
          <span style={{ opacity: 0.5 }}>
            <Loader size={12} style={{ animation: "spin 1s linear infinite" }} />
          </span>
        )}
        {streaming && message.content && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 13,
              background: "var(--accent-primary)",
              borderRadius: 2,
              marginLeft: 3,
              verticalAlign: "text-bottom",
              animation: "blink 0.8s step-end infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
