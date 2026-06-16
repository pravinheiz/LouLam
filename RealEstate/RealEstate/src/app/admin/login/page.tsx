"use client";

import React, { useState, Suspense } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Trigger credentials authentication
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid credentials. Access Denied.");
        setLoading(false);
        return;
      }

      // 2. Retrieve session info to verify the role in frontend
      const sessionResponse = await fetch("/api/auth/session");
      const session = await sessionResponse.json();

      if (session?.user?.role !== "ADMIN") {
        // Log out immediately if the user is not an admin
        await signOut({ redirect: false });
        setError("Strictly unauthorized. Admin privileges required.");
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again later.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Matrix/Security Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />

      {/* Card Wrapper */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl border border-emerald-500/20 rounded-3xl p-8 sm:p-10 shadow-3xl relative z-10">
        
        {/* Brand/Security Logo */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 p-3 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/10 animate-pulse">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-black text-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              Admin Control Center
            </h1>
            <p className="text-emerald-500/80 text-[10px] font-bold mt-1.5 uppercase tracking-widest">
              Secured Console Gateway
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Operator Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="operator@athubiholding.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-white placeholder-slate-600 transition-all font-mono"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="current-password" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Security keyphrase
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                id="current-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-white placeholder-slate-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Authenticate Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Accessing Core...
              </>
            ) : (
              "Authenticate Portal"
            )}
          </button>
        </form>

        {/* Return to Marketplace Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Marketplace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}
