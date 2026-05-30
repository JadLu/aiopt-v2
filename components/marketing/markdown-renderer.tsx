"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 16px", lineHeight: 1.3 }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{
      fontSize: 16, fontWeight: 700, color: "var(--accent-primary)",
      margin: "32px 0 12px", paddingBottom: 8,
      borderBottom: "1px solid var(--border-default)", lineHeight: 1.3,
    }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "20px 0 8px", lineHeight: 1.4 }}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: "16px 0 6px" }}>
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 12px" }}>
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "0 0 14px", paddingLeft: 20, listStyleType: "none" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "0 0 14px", paddingLeft: 20 }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{
      fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75,
      marginBottom: 5, paddingLeft: 4, position: "relative",
    }}>
      <span style={{
        position: "absolute", left: -14, top: 8,
        width: 5, height: 5, borderRadius: "50%",
        background: "var(--accent-primary)", display: "inline-block", flexShrink: 0,
      }} />
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
      {children}
    </em>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: "3px solid var(--accent-primary)",
      paddingLeft: 14, margin: "12px 0",
      color: "var(--text-tertiary)", fontStyle: "italic",
    }}>
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code style={{
      background: "var(--bg-subtle)", borderRadius: 4,
      padding: "2px 6px", fontSize: 12, color: "var(--accent-primary)",
      fontFamily: "monospace",
    }}>
      {children}
    </code>
  ),
  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: "24px 0" }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", marginBottom: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{
      textAlign: "left", padding: "8px 12px", fontSize: 11,
      fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.05em",
      textTransform: "uppercase", borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-subtle)",
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: "9px 12px", color: "var(--text-secondary)",
      borderBottom: "1px solid var(--border-default)", verticalAlign: "top",
    }}>
      {children}
    </td>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div style={{ wordBreak: "break-word" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
