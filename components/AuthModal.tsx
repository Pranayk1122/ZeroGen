"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Mail, User, AlertCircle, Loader2 } from "lucide-react";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; email: string; name: string }) => void;
  accentTheme?: "cyan" | "violet" | "emerald";
  theme?: "dark" | "light";
};

export function AuthModal({ isOpen, onClose, onSuccess, accentTheme = "cyan", theme = "dark" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const accentButton = {
    cyan: "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
    violet: "bg-violet-500 hover:bg-violet-400 text-white",
    emerald: "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
  }[accentTheme];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "signup" ? { name: name.trim(), email: trimmedEmail, password } : { email: trimmedEmail, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onSuccess(data.user);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-2xl ${
            theme === "dark" ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-800/60 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Brand header */}
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">ZeroGen Security</span>
            <h2 className="mt-1 text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {mode === "login" ? "Sign in to access your saved conversations & workspace" : "Register to start your persistent AI experience"}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="mb-5 flex rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Banner */}
          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs sm:text-sm text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${accentButton}`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
