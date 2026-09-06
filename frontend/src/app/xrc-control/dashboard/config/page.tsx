"use client";

import { useEffect, useState } from "react";
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  Crown,
  Sparkles,
  UserCheck,
  Plus,
  X,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { fetchSiteConfig, updateSiteConfig, AdminConfigResponse } from "@/lib/admin-api";

export default function ConfigPage() {
  const [data, setData] = useState<AdminConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [freeCredits, setFreeCredits] = useState<number>(15);
  const [proCredits, setProCredits] = useState<number>(200);
  const [eliteCredits, setEliteCredits] = useState<number>(400);
  const [vipEmails, setVipEmails] = useState<string[]>([]);
  const [newVipEmail, setNewVipEmail] = useState("");

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ key: string; message: string } | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchSiteConfig();
      setData(res);
      setFreeCredits(Number(res.configs.FREE_TIER_CREDITS) || 15);
      setProCredits(Number(res.configs.PRO_CREDITS) || 200);
      setEliteCredits(Number(res.configs.ELITE_CREDITS) || 400);

      const vips = Array.isArray(res.configs.VIP_EMAILS) ? res.configs.VIP_EMAILS : [];
      setVipEmails(vips);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load site configurations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (key: string, value: unknown) => {
    setSavingKey(key);
    setSaveStatus(null);
    try {
      await updateSiteConfig(key, value);
      setSaveStatus({ key, message: "Changes saved and applied globally." });
      await loadConfig();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update configuration.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddVip = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newVipEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (vipEmails.includes(email)) {
      alert("This email is already in the VIP list.");
      return;
    }
    setVipEmails([...vipEmails, email]);
    setNewVipEmail("");
  };

  const handleRemoveVip = (emailToRemove: string) => {
    setVipEmails(vipEmails.filter((e) => e !== emailToRemove));
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-sm">Loading system configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Live global parameters. Modifications take effect immediately across all client sessions.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Config Cards */}
      <div className="space-y-6">
        {/* Card 1: Free Tier Initial Credits */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">FREE_TIER_CREDITS</h2>
                <p className="text-xs text-slate-500">
                  Initial AI credits granted automatically to every newly registered user.
                </p>
              </div>
            </div>
            {saveStatus?.key === "FREE_TIER_CREDITS" && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min="0"
              value={freeCredits}
              onChange={(e) => setFreeCredits(parseInt(e.target.value) || 0)}
              className="w-36 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={() => handleSave("FREE_TIER_CREDITS", freeCredits)}
              disabled={savingKey === "FREE_TIER_CREDITS"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer shadow-xs"
            >
              {savingKey === "FREE_TIER_CREDITS" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Setting</span>
            </button>
          </div>

          {data?.last_updated?.FREE_TIER_CREDITS?.updated_at && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(data.last_updated.FREE_TIER_CREDITS.updated_at).toLocaleString()}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                By {data.last_updated.FREE_TIER_CREDITS.updated_by || "Admin"}
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Pro Credits */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">PRO_CREDITS</h2>
                <p className="text-xs text-slate-500">
                  Monthly recurring credits replenished for active Pro tier subscribers.
                </p>
              </div>
            </div>
            {saveStatus?.key === "PRO_CREDITS" && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min="0"
              value={proCredits}
              onChange={(e) => setProCredits(parseInt(e.target.value) || 0)}
              className="w-36 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={() => handleSave("PRO_CREDITS", proCredits)}
              disabled={savingKey === "PRO_CREDITS"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer shadow-xs"
            >
              {savingKey === "PRO_CREDITS" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Setting</span>
            </button>
          </div>

          {data?.last_updated?.PRO_CREDITS?.updated_at && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(data.last_updated.PRO_CREDITS.updated_at).toLocaleString()}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                By {data.last_updated.PRO_CREDITS.updated_by || "Admin"}
              </span>
            </div>
          )}
        </div>

        {/* Card 3: Elite Credits */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">ELITE_CREDITS</h2>
                <p className="text-xs text-slate-500">
                  Monthly recurring credits replenished for active Elite tier subscribers.
                </p>
              </div>
            </div>
            {saveStatus?.key === "ELITE_CREDITS" && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min="0"
              value={eliteCredits}
              onChange={(e) => setEliteCredits(parseInt(e.target.value) || 0)}
              className="w-36 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={() => handleSave("ELITE_CREDITS", eliteCredits)}
              disabled={savingKey === "ELITE_CREDITS"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer shadow-xs"
            >
              {savingKey === "ELITE_CREDITS" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Setting</span>
            </button>
          </div>

          {data?.last_updated?.ELITE_CREDITS?.updated_at && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(data.last_updated.ELITE_CREDITS.updated_at).toLocaleString()}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                By {data.last_updated.ELITE_CREDITS.updated_by || "Admin"}
              </span>
            </div>
          )}
        </div>

        {/* Card 4: VIP Emails List */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">VIP_EMAILS</h2>
                <p className="text-xs text-slate-500">
                  Accounts that automatically receive VIP allocation (300 credits) on registration.
                </p>
              </div>
            </div>
            {saveStatus?.key === "VIP_EMAILS" && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          {/* Add VIP Form */}
          <form onSubmit={handleAddVip} className="flex gap-2 mb-4 pt-1">
            <input
              type="email"
              value={newVipEmail}
              onChange={(e) => setNewVipEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 max-w-sm px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to list</span>
            </button>
          </form>

          {/* Tags list */}
          <div className="flex flex-wrap gap-2 mb-4">
            {vipEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-mono font-medium border border-slate-200/60"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveVip(email)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <button
            onClick={() => handleSave("VIP_EMAILS", vipEmails)}
            disabled={savingKey === "VIP_EMAILS"}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer shadow-xs"
          >
            {savingKey === "VIP_EMAILS" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save VIP List</span>
          </button>

          {data?.last_updated?.VIP_EMAILS?.updated_at && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(data.last_updated.VIP_EMAILS.updated_at).toLocaleString()}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                By {data.last_updated.VIP_EMAILS.updated_by || "Admin"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
