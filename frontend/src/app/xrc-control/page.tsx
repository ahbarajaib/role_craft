"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, ArrowRight, KeyRound, AlertCircle, Loader2, CheckCircle2, ChevronLeft } from "lucide-react";
import { loginAdminStep1, verifyAdminPinStep2, isAdminLoggedIn, clearAdminSession } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already logged in, redirect directly to dashboard
  useEffect(() => {
    if (isAdminLoggedIn()) {
      router.replace("/xrc-control/dashboard");
    }
  }, [router]);

  const handleStep1Login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      await loginAdminStep1(email.trim(), password);
      setSuccessMessage("Credentials verified. Enter Admin Secret PIN.");
      setStep(2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2PinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!pin.trim()) {
      setErrorMessage("Please enter your Admin Secret PIN.");
      return;
    }

    setIsLoading(true);
    try {
      await verifyAdminPinStep2(pin.trim());
      setSuccessMessage("Authentication successful. Redirecting to control panel...");
      setTimeout(() => {
        router.push("/xrc-control/dashboard");
      }, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid Admin PIN.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    clearAdminSession();
    setStep(1);
    setPin("");
    setPassword("");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            RoleCraft Control Center
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1
              ? "Layer 1: Administrator Credentials"
              : "Layer 2: Secret PIN Verification"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8">
          {/* Status Messages */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && !errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <div className="font-medium">{successMessage}</div>
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Email + Password */
            <form onSubmit={handleStep1Login} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rolecraft.tech"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Next: PIN Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Secret PIN Verification */
            <form onSubmit={handleStep2PinVerify} className="space-y-5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
                <span className="truncate font-medium text-slate-800">{email}</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-indigo-600 hover:text-indigo-700 font-medium ml-2 cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Admin Secret PIN
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter your 16+ character PIN"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono tracking-wider"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Set on your server as ADMIN_SECRET. 5 failed attempts will lock out your account.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Unlock Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security badge footer */}
        <div className="mt-8 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Restricted Portal · 2-Factor Enforced · 7-Day Session Expiry</span>
        </div>
      </div>
    </div>
  );
}
