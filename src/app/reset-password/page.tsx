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
        <label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          New Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-11 pr-11 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-11 pr-11 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-600/20"
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Card Wrapper */}
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loulam-logo.png" alt="LouLam" className="h-16 w-auto" />
          <div>
            <h1 className="font-extrabold text-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
              Create New Password
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              Your new password must be different from previous used passwords.
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
