"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, Cpu, User, Palette, MessageSquare, Shield, Sparkles, Sun, Moon } from "lucide-react";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; email: string; name: string } | null;
  settings: {
    theme: "dark" | "light";
    accent_theme: "cyan" | "violet" | "emerald";
    persona: "helper" | "coder" | "writer" | "analyst";
    ai_mode: "fast" | "thinking" | "deep";
    task_mode: "default" | "explain" | "rewrite";
    system_prompt: string;
    compact_mode: number;
    use_memory: number;
    memory: string;
  };
  onUpdateSettings: (newSettings: Partial<SettingsModalProps["settings"]>) => Promise<void>;
  onLogout: () => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  user,
  settings,
  onUpdateSettings,
  onLogout,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "ai" | "memory" | "account">("general");
  const [systemPrompt, setSystemPrompt] = useState(settings.system_prompt);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSystemPrompt(settings.system_prompt);
  }, [settings.system_prompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = settings.theme === "dark";

  const handleSavePrompt = async () => {
    await onUpdateSettings({ system_prompt: systemPrompt });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleClearMemory = async () => {
    if (confirm("Are you sure you want to clear your conversation memory context?")) {
      await onUpdateSettings({ memory: "No saved memory yet." });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          className={`relative z-10 flex h-[90vh] max-h-[640px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl transition-colors ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b px-6 py-4 ${
            isDark ? "border-slate-800/80 bg-slate-950" : "border-slate-200 bg-slate-50"
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500">
                <Sparkles className="h-4 w-4 text-slate-950" />
              </div>
              <div>
                <h3 className="text-base font-bold">ZeroGen Settings</h3>
                <p className="text-xs text-slate-400">Configure appearance, model preferences, and workspace profile</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`rounded-xl p-2 transition ${
                isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              }`}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className={`w-44 sm:w-52 border-r p-3 space-y-1 ${
              isDark ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200 bg-slate-50/50"
            }`}>
              <button
                onClick={() => setActiveTab("general")}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                  activeTab === "general"
                    ? isDark ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : isDark ? "text-slate-400 hover:bg-slate-800/50 hover:text-white" : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span>Appearance</span>
              </button>

              <button
                onClick={() => setActiveTab("ai")}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                  activeTab === "ai"
                    ? isDark ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : isDark ? "text-slate-400 hover:bg-slate-800/50 hover:text-white" : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <Cpu className="h-4 w-4 shrink-0" />
                <span>AI & Behavior</span>
              </button>

              <button
                onClick={() => setActiveTab("memory")}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                  activeTab === "memory"
                    ? isDark ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : isDark ? "text-slate-400 hover:bg-slate-800/50 hover:text-white" : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>Memory</span>
              </button>

              <button
                onClick={() => setActiveTab("account")}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                  activeTab === "account"
                    ? isDark ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : isDark ? "text-slate-400 hover:bg-slate-800/50 hover:text-white" : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Account</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Theme</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onUpdateSettings({ theme: t })}
                          className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold transition ${
                            settings.theme === t
                              ? isDark ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-sm" : "border-cyan-500 bg-cyan-50 text-cyan-800"
                              : isDark ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                          <span className="capitalize">{t} Mode</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Accent Color</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {(["cyan", "violet", "emerald"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => onUpdateSettings({ accent_theme: a })}
                          className={`rounded-2xl border p-3 capitalize text-xs font-semibold transition flex items-center justify-center gap-2 ${
                            settings.accent_theme === a
                              ? isDark ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-sm" : "border-cyan-500 bg-cyan-50 text-cyan-800"
                              : isDark ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                a === "cyan" ? "#22d3ee" : a === "violet" ? "#a855f7" : "#10b981",
                            }}
                          />
                          <span>{a}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Display Density</label>
                    <label className={`flex items-center gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                      isDark ? "border-slate-800 bg-slate-900/60 hover:border-slate-700" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.compact_mode)}
                        onChange={(e) => onUpdateSettings({ compact_mode: e.target.checked ? 1 : 0 })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div>
                        <p className="text-xs font-semibold">Compact Message View</p>
                        <p className="text-[11px] text-slate-400">Reduce bubble padding for dense conversation workflows</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === "ai" && (
                <div className="space-y-6">
                  {/* ZeroGen Model Tiers Info */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">ZeroGen Model Tiers</label>
                    <div className="grid gap-2 text-xs">
                      <div className={`rounded-xl border p-2.5 flex items-center justify-between ${
                        isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div>
                          <p className="font-semibold text-cyan-400">ZeroGen Fast</p>
                          <p className="text-[11px] text-slate-400">Low-latency response & instant streaming</p>
                        </div>
                        <span className="rounded-md bg-cyan-500/15 text-cyan-300 px-2 py-0.5 text-[10px] font-bold">Fast</span>
                      </div>

                      <div className={`rounded-xl border p-2.5 flex items-center justify-between ${
                        isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div>
                          <p className="font-semibold text-violet-400">ZeroGen Pro</p>
                          <p className="text-[11px] text-slate-400">Balanced intelligence for complex code & writing</p>
                        </div>
                        <span className="rounded-md bg-violet-500/15 text-violet-300 px-2 py-0.5 text-[10px] font-bold">Pro</span>
                      </div>

                      <div className={`rounded-xl border p-2.5 flex items-center justify-between ${
                        isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div>
                          <p className="font-semibold text-emerald-400">ZeroGen Ultra</p>
                          <p className="text-[11px] text-slate-400">Deep reasoning & maximum context capacity</p>
                        </div>
                        <span className="rounded-md bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">Ultra</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Assistant Persona</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["helper", "coder", "writer", "analyst"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onUpdateSettings({ persona: p })}
                          className={`rounded-2xl border p-3 text-left capitalize text-xs font-medium transition ${
                            settings.persona === p
                              ? isDark ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-sm" : "border-cyan-500 bg-cyan-50 text-cyan-800 font-semibold"
                              : isDark ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          <p className="font-semibold">{p}</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                            {p === "helper" && "Balanced general assistant"}
                            {p === "coder" && "Senior engineer architecture"}
                            {p === "writer" && "Polished prose & rhetoric"}
                            {p === "analyst" && "Rigorous strategy evaluation"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Reasoning Mode</label>
                    <div className="flex gap-2.5">
                      {(["fast", "thinking", "deep"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onUpdateSettings({ ai_mode: m })}
                          className={`flex-1 rounded-2xl border p-2.5 text-center capitalize text-xs font-semibold transition ${
                            settings.ai_mode === m
                              ? isDark ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-sm" : "border-cyan-500 bg-cyan-50 text-cyan-800"
                              : isDark ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Custom System Instructions</label>
                    <p className="text-[11px] text-slate-400 mb-2">Personalize ZeroGen behavior across all conversations</p>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={3}
                      className={`w-full rounded-2xl border p-3 text-xs outline-none resize-none ${
                        isDark
                          ? "border-slate-700 bg-slate-900/80 text-white placeholder-slate-500 focus:border-cyan-400"
                          : "border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-cyan-500"
                      }`}
                      placeholder="e.g. Always include types in TypeScript code examples."
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSavePrompt}
                        className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
                      >
                        {savedSuccess ? "Saved!" : "Save Instructions"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "memory" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Memory Context</p>
                      <p className="text-xs text-slate-400">ZeroGen retains key details to personalize subsequent conversations</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearMemory}
                      className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear Memory</span>
                    </button>
                  </div>

                  <div className={`rounded-2xl border p-4 font-mono text-xs max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed ${
                    isDark ? "border-slate-800 bg-slate-900/80 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}>
                    {settings.memory || "No saved memory yet."}
                  </div>

                  <label className={`flex items-center gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                    isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"
                  }`}>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.use_memory)}
                      onChange={(e) => onUpdateSettings({ use_memory: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-medium">Enable automatic memory learning</span>
                  </label>
                </div>
              )}

              {activeTab === "account" && (
                <div className="space-y-6">
                  <div className={`rounded-2xl border p-4 ${
                    isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 font-bold text-lg">
                        {user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{user?.name || "ZeroGen User"}</h4>
                        <p className="text-xs text-slate-400">{user?.email || "user@zerogen.app"}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      <span>ZeroGen Server-side Session Active</span>
                    </div>
                  </div>

                  <div className={`border-t pt-4 flex justify-between items-center ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Session Management</p>
                      <p className="text-xs text-slate-400">Sign out of ZeroGen on this device</p>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
