"use client";

import React, { useState } from "react";
import { useAuth } from "./auth_provider";
import { X, Check, ShieldAlert, Sparkles, Zap, Award, RefreshCw } from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawApiUrl.replace(/\/api\/v1\/?$/, "");

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, token, refreshMe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "elite">("pro");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Dynamically load Razorpay Checkout Script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    if (!token) {
      setError("Please sign in or register to purchase a subscription.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment checkout script. Check your internet connection.");
      }

      // 1. Create subscription session on the backend
      const response = await fetch(`${API_BASE_URL}/api/v1/payment/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: selectedPlan }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.detail || "Failed to create subscription session.");
      }

      const session = await response.json();

      // 2. Handle Sandbox simulation mode if keys are empty
      if (session.is_sandbox) {
        // Trigger simulated success call
        const successRes = await fetch(`${API_BASE_URL}/api/v1/payment/simulate-success`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan_type: selectedPlan }),
        });

        if (!successRes.ok) {
          throw new Error("Failed to process sandbox upgrade.");
        }

        await refreshMe();
        onClose();
        return;
      }

      // 3. Launch live Razorpay Checkout checkout modal
      const options = {
        key: session.key,
        subscription_id: session.subscription_id,
        name: "Role Craft Engine",
        description: session.description,
        image: "/logo.png",
        handler: async function (checkoutResponse: any) {
          // Poll profile until webhook upgrades them, or reload immediately
          setIsSubmitting(true);
          try {
            await new Promise((r) => setTimeout(r, 2000));
            await refreshMe();
            onClose();
          } catch (err) {
            console.error(err);
          } finally {
            setIsSubmitting(false);
          }
        },
        prefill: {
          email: user?.email || "",
        },
        theme: {
          color: "#4f46e5", // indigo-600
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err: any) {
      setError(err?.message || "An unexpected checkout error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl p-4 sm:p-8 border border-slate-200 bg-white shadow-2xl flex flex-col space-y-5 sm:space-y-6 max-h-[95vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 pt-2 sm:pt-0">
          <div className="inline-flex h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 items-center justify-center border border-emerald-500/25 mx-auto">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Upgrade to Role Craft Premium
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Unlock professional resume optimizations, unlimited AI rewrites, and instant downloads.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Plan Cards Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Pro Plan Card */}
          <div
            onClick={() => setSelectedPlan("pro")}
            className={`relative rounded-xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
              selectedPlan === "pro"
                ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white/40 dark:bg-slate-950/20"
            }`}
          >
            {selectedPlan === "pro" && (
              <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[9px] uppercase tracking-wider shadow">
                Selected
              </div>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> Pro Plan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Perfect for active job seekers.
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">₹399</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">₹2,000</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">/ mo</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-350 border-t border-slate-200 dark:border-slate-850 pt-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span><strong>200 Optimization Credits</strong> / mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>AI Section Rewrites & Keyword Weaving</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Patched DOCX & PDF Downloads</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Elite Plan Card */}
          <div
            onClick={() => setSelectedPlan("elite")}
            className={`relative rounded-xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
              selectedPlan === "elite"
                ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white/40 dark:bg-slate-950/20"
            }`}
          >
            {selectedPlan === "elite" && (
              <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[9px] uppercase tracking-wider shadow">
                Selected
              </div>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Award className="h-4 w-4" /> Elite Plan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Maximum capacity for power job seekers.
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">₹599</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">₹3,000</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">/ mo</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-350 border-t border-slate-200 dark:border-slate-850 pt-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span><strong>400 Optimization Credits</strong> / mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>AI Section Rewrites & Keyword Weaving</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Priority support & fast generation</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Subscribe Button CTA */}
        <button
          onClick={handleSubscribe}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            `Upgrade to ${selectedPlan.toUpperCase()} Plan`
          )}
        </button>

        {/* Footer Disclaimer */}
        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 leading-relaxed">
          Cancel subscription anytime. Your payments are processed securely via Razorpay. Billed monthly. Simulated Sandbox upgrades apply immediately without actual charges if API keys are missing.
        </p>

      </div>
    </div>
  );
}
