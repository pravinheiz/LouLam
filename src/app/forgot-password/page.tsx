"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send reset link");
      }

      setMessage(data.message || "A password reset link has been sent to your email.");
      setEmail("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Card Wrapper */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] border border-white/60 dark:border-slate-800/50 p-8 sm:p-10 shadow-2xl shadow-slate-900/5 relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loulam-logo.png" alt="LouLam" className="h-16 w-auto" />
          <div>
            <h1 className="font-black text-[22px] text-slate-900 dark:text-white tracking-tight font-sans">
              Reset Password
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 font-black tracking-widest uppercase">
              Enter email to receive link
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2">
            ✅ {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email Address Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-[15px] font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[15px] font-black tracking-wide transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-xl shadow-slate-900/10 dark:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[11px] font-black text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
