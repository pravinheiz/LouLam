"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("No reset token found in the URL.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-sm font-semibold mb-6 flex flex-col items-center gap-3">
          <span>⚠️ Invalid or missing password reset token.</span>
          <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 transition-colors">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center flex flex-col items-center gap-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-2xl text-sm font-semibold flex flex-col items-center gap-3 w-full">
          <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
            ✓
          </div>
          <span className="text-base text-white">Password successfully reset!</span>
          <span className="text-xs text-emerald-500/80">Redirecting to login...</span>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          Click here if you are not automatically redirected
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* New Password Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
          New Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-400" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-11 pr-11 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-[15px] font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-400" />
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-11 pr-11 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-[15px] font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[15px] font-black tracking-wide transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-xl shadow-slate-900/10 dark:shadow-none cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Resetting...
          </>
        ) : (
          "Reset Password"
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
              Create New Password
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 font-black tracking-widest uppercase">
              Use a unique password
            </p>
          </div>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>

      </div>
    </div>
  );
}
