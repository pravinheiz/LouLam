"use client";

import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Role } from "@/types/db";
import {
  Compass,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Calendar,
  Phone,
  Camera,
  Upload,
  CheckCircle,
} from "lucide-react";
import { initFirebaseClient } from "@/lib/firebase-client";
import { uploadToFirebaseStorage } from "@/lib/firebase-upload";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("https://api.dicebear.com/7.x/initials/svg?seed=User");
  const role = Role.BUYER;

  // UI / Logic States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar Upload States
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Email Verification States (Firebase Link)
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false); // Used as "Email Link Sent" flag
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);

  // Firebase Auth states
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);

  // Load Firebase Config dynamically
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/auth/otp/config", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.firebaseEnabled) {
            setFirebaseEnabled(true);
            setFirebaseConfig(data.data.config);
          }
        }
      } catch (err) {
        console.error("Failed to fetch Firebase OTP config:", err);
      }
    };
    fetchConfig();
  }, []);

  // Recaptcha and Phone Cooldown timers removed as phone verification is disabled

  // Email OTP Cooldown Timer
  useEffect(() => {
    if (emailOtpCooldown > 0) {
      const timer = setTimeout(() => setEmailOtpCooldown(emailOtpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailOtpCooldown]);

  // Firebase Storage Uploader
  const uploadToFirebase = async (file: File): Promise<string> => {
    return uploadToFirebaseStorage(file, "profile-avatars");
  };

  // Handle Profile Picture Selection
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      setAvatarLoading(true);
      setError(null);
      const url = await uploadToFirebase(file);
      setAvatarUrl(url);
      alert("Profile picture uploaded successfully!");
    } catch (err: any) {
      console.error(err);
      // Fallback placeholder avatar so mock Cloudinary credentials do not block registration
      const fallbackUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "User")}`;
      setAvatarUrl(fallbackUrl);
      setError(`Profile picture upload failed (using fallback initials avatar). Reason: ${err.message}`);
    } finally {
      setAvatarLoading(false);
    }
  };

  // Handle Full Name Change to update initials preview dynamically
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (avatarUrl.startsWith("https://api.dicebear.com/7.x/initials/svg")) {
      setAvatarUrl(`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newName || "User")}`);
    }
  };

  // Phone OTP methods removed

  // Send Email verification Link
  const handleSendEmailOtp = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address first");
      return;
    }

    if (!password || password.trim().length < 6) {
      setError("Please enter a password of at least 6 characters first before sending the verification email.");
      return;
    }

    try {
      setError(null);

      // Check duplication in database first
      const checkRes = await fetch("/api/auth/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.message || "Email address is already in use");
      }

      setEmailOtpCooldown(60);

      if (firebaseEnabled && firebaseConfig) {
        const auth = initFirebaseClient(firebaseConfig);
        let user;

        try {
          console.log("Creating new user account in Firebase Auth...");
          const userCred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
          user = userCred.user;
        } catch (err: any) {
          if (err.code === "auth/email-already-in-use") {
            // Attempt to sign in to see if it is the same user verifying their account
            console.log("Email already exists in Firebase. Attempting password verification...");
            try {
              const userCred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
              user = userCred.user;
            } catch (signInErr: any) {
              console.error(signInErr);
              throw new Error("This email address is already registered with another account.");
            }
          } else {
            throw err;
          }
        }

        if (user.emailVerified) {
          setIsEmailVerified(true);
          const token = await user.getIdToken(true);
          setFirebaseToken(token);
          alert("Email address is already verified!");
        } else {
          console.log("Sending verification link...");
          await sendEmailVerification(user);
          setIsEmailOtpSent(true);
          alert("Verification email sent! Please check your inbox and click the verification link, then click 'Verify Status'.");
        }
      } else {
        throw new Error("Firebase Authentication is not configured.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send verification link");
      setEmailOtpCooldown(0);
    }
  };

  // Verify Email Link verification status
  const handleVerifyEmailOtp = async () => {
    try {
      setError(null);
      setVerifyingEmailOtp(true);

      if (firebaseEnabled && firebaseConfig) {
        const auth = initFirebaseClient(firebaseConfig);
        const user = auth.currentUser;
        if (!user) {
          throw new Error("No active email verification session found. Please enter your credentials and request a link first.");
        }

        console.log("Checking email verification status...");
        await user.reload();
        if (user.emailVerified) {
          setIsEmailVerified(true);
          const token = await user.getIdToken(true);
          setFirebaseToken(token);
          alert("Email address verified successfully!");
        } else {
          alert("Email address has not been verified yet. Please click the link in your verification email first.");
        }
      } else {
        throw new Error("Firebase Authentication is not configured.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to check email verification status.");
    } finally {
      setVerifyingEmailOtp(false);
    }
  };

  // Submit Registration Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !dateOfBirth || !phone || !firebaseToken) {
      setError("Please fill out all required fields");
      return;
    }

    if (!avatarUrl) {
      setError("A profile picture is required to register your profile");
      return;
    }

    if (!isEmailVerified) {
      setError("Please verify your email address via link first");
      return;
    }

    // Client-side age validation
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      setError("You must be at least 18 years old to register");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Send API register request
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          dateOfBirth,
          phone,
          firebaseToken,
          image: avatarUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed. Please try again.");
      }

      // 2. Automatically sign in the user
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        router.push("/login?error=auto_signin_failed");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Something went wrong. Please check your inputs.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Card Wrapper */}
      <div className="w-full max-w-lg bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loulam-logo.png" alt="LouLam" className="h-14 w-auto" />
          <div>
            <h1 className="font-extrabold text-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight font-sans">
              Create Profile
            </h1>
            <p className="text-slate-400 text-xs mt-1.5 font-medium tracking-wide">
              JOIN LOULAM MARKETPLACE
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Circular Profile Picture Upload */}
          <div className="flex flex-col items-center gap-2.5 mb-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Profile Picture
            </label>
            <div className="relative group cursor-pointer h-24 w-24 rounded-full overflow-hidden border-2 border-indigo-500/30 bg-slate-850 hover:border-indigo-500 transition-all shadow-md">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                  {avatarLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  ) : (
                    <>
                      <Camera className="h-6 w-6 mb-1" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Upload</span>
                    </>
                  )}
                </div>
              )}
              {!avatarLoading && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="Upload profile picture"
                  required={!avatarUrl}
                />
              )}
              {avatarUrl && !avatarLoading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-500 font-semibold tracking-wide uppercase">
              {avatarUrl ? "Change Photo" : "JPG / PNG under 5MB (Required)"}
            </p>
          </div>

          {/* Full Name Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="John Doe"
                value={name}
                onChange={handleNameChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all font-sans"
              />
            </div>
          </div>

          {/* Email Address & OTP Send Group */}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Email Address
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={isEmailVerified}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-sans"
                />
              </div>
              <button
                type="button"
                onClick={handleSendEmailOtp}
                disabled={isEmailVerified || emailOtpCooldown > 0 || !email}
                className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-indigo-600/10 cursor-pointer min-w-[100px]"
              >
                {emailOtpCooldown > 0 ? `${emailOtpCooldown}s` : isEmailOtpSent ? "Resend Link" : "Send Link"}
              </button>
            </div>
          </div>

          {/* Email verification status Checking Card */}
          {isEmailOtpSent && !isEmailVerified && (
            <div className="flex flex-col gap-3 bg-slate-900/30 p-4 border border-slate-800/60 rounded-2xl">
              <p className="text-xs font-semibold text-slate-350 leading-relaxed">
                Verification link has been sent to your email! Please open your email inbox, click the verification link, and click below to check status.
              </p>
              <button
                type="button"
                onClick={handleVerifyEmailOtp}
                disabled={verifyingEmailOtp}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                {verifyingEmailOtp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Verify Status"
                )}
              </button>
            </div>
          )}

          {isEmailVerified && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5 rounded-2xl text-emerald-450 text-xs font-bold mt-1">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Email address verified successfully via Firebase!</span>
            </div>
          )}

          {/* Date of Birth Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="dateOfBirth" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Date of Birth (Must be 18+)
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all font-sans"
              />
            </div>
          </div>

          {/* Mobile Number Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="e.g. +919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="new-password" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                id="new-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 transition-all font-sans"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isEmailVerified || !avatarUrl}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        {/* Footer Links */}
        <p className="text-center text-xs font-semibold text-slate-500 mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-bold font-sans">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
