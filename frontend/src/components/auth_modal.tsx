"use client";

import React, { useState } from "react";
import { useAuth } from "./auth_provider";
import { GoogleLogin } from "@react-oauth/google";
import { FREE_TIER_CREDITS } from "@/lib/constants";
import { X, Sparkles, Mail, Lock, AlertCircle, RefreshCw, User } from "lucide-react";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, signup, googleLogin, authModalContext } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!showAuthModal) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const emailClean = email.trim();
    if (!emailClean) {
      setError("Please enter your email address.");
      return;
    }
    setIsSubmitting(true);
    try {
      const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const apiUrl = rawApiUrl.replace(/\/api\/v1\/?$/, "");
      const res = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailClean }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        setError(data?.message || data?.error?.detail || "Password reset request failed.");
        return;
      }
      setSuccessMessage(data.message || `Password reset instructions have been sent to ${emailClean}.`);
    } catch (err: any) {
      setError(err?.message || "Password reset request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "forgot") {
      return handleForgotPassword(e);
    }

    setError(null);
    setSuccessMessage(null);

    const emailClean = email.trim();
    if (!emailClean || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (authMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === "signup") {
        await signup(emailClean, password, name.trim() || undefined);
      } else {
        await login(emailClean, password);
      }
    } catch (err: any) {
      setError(err?.message || "An authentication error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      if (credentialResponse.credential) {
        await googleLogin(credentialResponse.credential);
      }
    } catch (err: any) {
      setError(err?.message || "Google Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in-up">
      <div className="relative w-full max-w-md rounded-2xl p-5 sm:p-8 border border-teal-100 bg-white shadow-2xl flex flex-col space-y-5 sm:space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl icon-gradient bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="h-6 w-6 text-white animate-pulse" />
          </div>
          {authModalContext?.score != null && authMode !== "forgot" ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                Your resume scores{" "}
                <span className="text-teal-600">{authModalContext.score}%</span>
                {" "}&mdash; fix it with AI
              </h2>
              <p className="text-xs text-slate-500">
                Sign in to unlock AI rewrites, keyword weaving, and DOCX patching.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">
                {authMode === "signup"
                  ? "Create your account"
                  : authMode === "forgot"
                  ? "Reset your password"
                  : "Sign in to RoleCraft"}
              </h2>
              <p className="text-xs text-slate-500">
                {authMode === "forgot"
                  ? "Enter your email address to receive password reset instructions."
                  : `Get ${FREE_TIER_CREDITS} free optimization credits and unlock AI rewrites.`}
              </p>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fade-in-up">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-fade-in-up">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Google Sign-In — Primary CTA (shown ABOVE email/password form) */}
        {authMode !== "forgot" && (
          <>
            <div className="flex justify-center w-full overflow-hidden">
              <div className="max-w-full overflow-hidden flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google authentication failed.")}
                  theme="outline"
                  size="large"
                  width="300px"
                />
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 -mt-1">
              Free to try &middot; No credit card &middot; {FREE_TIER_CREDITS} free AI rewrites included
            </p>

            {/* Separator */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Or continue with email</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
          </>
        )}

        {/* Main Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name field (Sign Up mode only) */}
          {authMode === "signup" && (
            <div className="space-y-1.5 animate-fade-in-up">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mohammed Ahbar"
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* Email Address field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Password field */}
          {authMode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Password
                </label>
                {authMode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-teal-600 hover:underline font-medium cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          )}

          {/* Confirm Password field (Sign Up mode only) */}
          {authMode === "signup" && (
            <div className="space-y-1.5 animate-fade-in-up">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl btn-primary text-sm shadow-lg shadow-teal-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : authMode === "signup" ? (
              "Sign Up"
            ) : authMode === "forgot" ? (
              "Send Reset Instructions"
            ) : (
              "Sign In"
            )}
          </button>
        </form>



        {/* Switch Auth mode text */}
        <div className="text-center text-xs text-slate-500">
          {authMode === "forgot" ? (
            <button
              onClick={() => {
                setAuthMode("signin");
                setError(null);
                setSuccessMessage(null);
              }}
              className="font-bold text-teal-600 hover:underline cursor-pointer focus:outline-none"
            >
              ← Back to Sign In
            </button>
          ) : authMode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("signin");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-teal-600 hover:underline cursor-pointer focus:outline-none"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              New to RoleCraft?{" "}
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-teal-600 hover:underline cursor-pointer focus:outline-none"
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
