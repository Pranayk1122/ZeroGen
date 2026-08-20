"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

type MarkdownRendererProps = {
  content: string;
  theme?: "dark" | "light";
};

export function MarkdownRenderer({ content, theme = "dark" }: MarkdownRendererProps) {
  const isDark = theme === "dark";

  return (
    <div className={`markdown-content space-y-3 text-sm sm:text-[15px] leading-relaxed ${isDark ? "text-slate-100" : "text-slate-900"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className && typeof children === "string" && !children.includes("\n");

            if (isInline) {
              return (
                <code
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[13px] font-medium ${
                    isDark
                      ? "bg-slate-800/90 text-cyan-300 border border-slate-700/60"
                      : "bg-slate-100 text-cyan-700 border border-slate-300"
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const codeText = String(children).replace(/\n$/, "");
            return <CodeBlock language={language} code={codeText} theme={theme} />;
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-7 font-normal">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl sm:text-2xl font-bold mt-5 mb-2.5 text-cyan-400 tracking-tight">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg sm:text-xl font-bold mt-4 mb-2 text-cyan-300 tracking-tight">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base sm:text-lg font-semibold mt-3.5 mb-1.5 tracking-tight">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2.5 space-y-1.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2.5 space-y-1.5">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote
                className={`border-l-4 border-cyan-500/80 pl-4 py-1.5 my-3 italic ${
                  isDark ? "bg-slate-900/60 text-slate-300" : "bg-slate-100/80 text-slate-700"
                } rounded-r-xl`}
              >
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-2xl border border-slate-700/60 shadow-sm">
                <table className="min-w-full divide-y divide-slate-700/60 text-left text-xs sm:text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className={isDark ? "bg-slate-900/90 font-semibold text-slate-200" : "bg-slate-100 font-semibold text-slate-800"}>{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className={`divide-y ${isDark ? "divide-slate-800/80" : "divide-slate-200"}`}>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className={isDark ? "hover:bg-slate-800/30 transition" : "hover:bg-slate-50 transition"}>{children}</tr>;
          },
          th({ children }) {
            return <th className="px-4 py-3 font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition font-medium"
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className={`my-5 ${isDark ? "border-slate-800" : "border-slate-200"}`} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, code, theme }: { language?: string; code: string; theme: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  const isDark = theme === "dark";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`group relative my-3.5 overflow-hidden rounded-2xl border shadow-md transition ${
      isDark ? "border-slate-800/90 bg-slate-950" : "border-slate-300 bg-slate-900 text-slate-100"
    }`}>
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/95 px-4 py-2 text-xs text-slate-400">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-200" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-200">
        <pre className="!m-0 !p-0">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
