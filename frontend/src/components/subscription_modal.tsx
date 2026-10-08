"use client";

import React, { useState } from "react";
import { PRO_CREDITS, ELITE_CREDITS } from "@/lib/constants";
import { useAuth } from "./auth_provider";
import { X, Check, ShieldAlert, Sparkles, Zap, Award, RefreshCw } from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReason?: "out_of_credits" | "extension_upsell" | "general";
  initialPlan?: "pro" | "elite";
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawApiUrl.replace(/\/api\/v1\/?$/, "");

export default function SubscriptionModal({
  isOpen,
  onClose,
  initialReason = "general",
  initialPlan,
}: SubscriptionModalProps) {
  const { user, token, refreshMe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "elite">("pro");
  const [billingType, setBillingType] = useState<"one_time" | "recurring">("one_time");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    } else if (user?.plan_type === "pro") {
      setSelectedPlan("elite");
    } else {
      setSelectedPlan("pro");
    }
  }, [isOpen, initialPlan, user?.plan_type]);

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

      // 1. Create checkout session on the backend (one-time pass or recurring subscription)
      const response = await fetch(`${API_BASE_URL}/api/v1/payment/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: selectedPlan, billing_type: billingType }),
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

      // 3. Launch live Razorpay Checkout modal
      const options: any = {
        key: session.key,
        amount: session.amount,
        name: "Role Craft Engine",
        description: session.description,
        image: "/icon.png",
        prefill: {
          email: user?.email || "",
        },
        theme: {
          color: "#0d9488", // brand teal
        },
        handler: async function (checkoutResponse: any) {
          setIsSubmitting(true);
          try {
            // Instantly verify payment signature & activate membership on server
            const verifyRes = await fetch(`${API_BASE_URL}/api/v1/payment/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: checkoutResponse.razorpay_payment_id,
                razorpay_subscription_id: checkoutResponse.razorpay_subscription_id || session.subscription_id,
                razorpay_order_id: checkoutResponse.razorpay_order_id || session.order_id,
                razorpay_signature: checkoutResponse.razorpay_signature,
                plan_type: selectedPlan,
                billing_type: billingType,
              }),
            });

            if (!verifyRes.ok) {
              console.warn("Direct verify failed, waiting for webhook fallback...");
              await new Promise((r) => setTimeout(r, 2000));
            }

            await refreshMe();
            onClose();
          } catch (err) {
            console.error("Checkout verify error:", err);
            await new Promise((r) => setTimeout(r, 2000));
            await refreshMe();
            onClose();
          } finally {
            setIsSubmitting(false);
          }
        },
      };

      if (session.order_id) {
        options.order_id = session.order_id;
      } else if (session.subscription_id) {
        options.subscription_id = session.subscription_id;
      }

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
      <div className="relative w-full max-w-2xl rounded-2xl p-4 sm:p-8 border border-teal-100 bg-white shadow-2xl flex flex-col space-y-5 sm:space-y-6 max-h-[95vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 pt-2 sm:pt-0">
          <div className="inline-flex h-10 w-10 rounded-xl icon-gradient bg-gradient-to-br from-teal-600 to-teal-500 items-center justify-center mx-auto shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            {initialReason === "out_of_credits" ? "Unlock More Tailoring Credits" : "Upgrade to RoleCraft Premium"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {initialReason === "out_of_credits"
              ? "You've depleted your credits. Upgrade to Pro (200 credits) or Elite (400 credits) to continue tailoring your resumes."
              : "Unlock professional resume optimizations, unlimited AI rewrites, and instant downloads."}
          </p>
        </div>

        {/* Contextual Out-of-Credits Banner */}
        {initialReason === "out_of_credits" && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-start gap-3 shadow-2xs">
            <Zap className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900">Credits Depleted (0 CR Remaining)</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Choose a plan below to immediately add fresh credits. Your uploaded resume and target job details will be ready to analyze immediately after upgrading.
              </p>
            </div>
          </div>
        )}

        {/* Billing Type Toggle */}
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl max-w-sm w-full border border-slate-200/80">
            <button
              type="button"
              onClick={() => setBillingType("one_time")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                billingType === "one_time"
                  ? "bg-white text-teal-800 shadow-xs ring-1 ring-slate-900/5 font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>30-Day Pass (One-Off)</span>
            </button>
            <button
              type="button"
              onClick={() => setBillingType("recurring")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                billingType === "recurring"
                  ? "bg-white text-teal-800 shadow-xs ring-1 ring-slate-900/5 font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Monthly Auto-Renew</span>
            </button>
          </div>
          <span className="text-[11px] text-teal-700 font-medium">
            {billingType === "one_time"
              ? "⚡ Pay once with UPI/GPay/Card — Zero auto-debits or recurring charges"
              : "🔄 Automatic monthly renewals — Cancel anytime with one click"}
          </span>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
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
                ? "border-teal-600 bg-teal-50/50 shadow-md ring-1 ring-teal-500/20"
                : "border-slate-200 hover:border-teal-300 bg-white/60"
            }`}
          >
            {selectedPlan === "pro" && (
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-extrabold text-[9px] uppercase tracking-wider shadow">
                Selected
              </div>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-teal-600" /> Pro Plan
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Perfect for active job seekers.
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">₹399</span>
                <span className="text-xs text-slate-400 line-through">₹2,000</span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {billingType === "one_time" ? "for 30 days" : "/ mo"}
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-200/80 pt-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span><strong className="text-slate-900">{PRO_CREDITS} Optimization Credits</strong> {billingType === "one_time" ? "granted" : "/ mo"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>AI Section Rewrites &amp; Keyword Weaving</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Patched DOCX &amp; PDF Downloads</span>
                </li>
                <li className="flex items-center gap-2 text-teal-800 font-semibold">
                  <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>LinkedIn 1-Click Copier Chrome Extension</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Elite Plan Card */}
          <div
            onClick={() => setSelectedPlan("elite")}
            className={`relative rounded-xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
              selectedPlan === "elite"
                ? "border-teal-600 bg-teal-50/50 shadow-md ring-1 ring-teal-500/20"
                : "border-slate-200 hover:border-teal-300 bg-white/60"
            }`}
          >
            {selectedPlan === "elite" && (
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-extrabold text-[9px] uppercase tracking-wider shadow">
                Selected
              </div>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-teal-600" /> Elite Plan
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Maximum capacity for power job seekers.
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">₹599</span>
                <span className="text-xs text-slate-400 line-through">₹3,000</span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {billingType === "one_time" ? "for 30 days" : "/ mo"}
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-200/80 pt-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span><strong className="text-slate-900">{ELITE_CREDITS} Optimization Credits</strong> {billingType === "one_time" ? "granted" : "/ mo"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Everything in Pro Plan</span>
                </li>
                <li className="flex items-center gap-2 text-teal-800 font-semibold">
                  <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>LinkedIn, Bayt &amp; Naukri 1-Click Copiers</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Priority support &amp; fast generation</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Subscribe Button CTA */}
        <button
          onClick={handleSubscribe}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl btn-primary text-sm shadow-lg shadow-teal-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed font-bold"
        >
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : billingType === "one_time" ? (
            `Get 30-Day ${selectedPlan.toUpperCase()} Pass (₹${selectedPlan === "pro" ? "399" : "599"} · One-Off)`
          ) : (
            `Subscribe to ${selectedPlan.toUpperCase()} (₹${selectedPlan === "pro" ? "399" : "599"} / mo)`
          )}
        </button>

        {/* Footer Disclaimer */}
        <p className="text-[10px] text-center text-slate-400 leading-relaxed">
          {billingType === "one_time"
            ? "Single one-time payment for 30 days of access. Zero recurring commitments or auto-debits. Works with all UPI apps (GPay, PhonePe, Paytm), NetBanking, and Cards."
            : "Cancel subscription anytime. Billed monthly via Razorpay auto-debit. Simulated Sandbox upgrades apply immediately without actual charges if API keys are missing."}
        </p>

      </div>
    </div>
  );
}
