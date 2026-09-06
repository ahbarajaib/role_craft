"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  X,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Phone,
  Globe,
  FileText,
  Calendar,
  Trash2,
} from "lucide-react";
import {
  fetchUsers,
  fetchUserDetail,
  updateUserCredits,
  updateUserPlan,
  toggleUserAdmin,
  deleteUser,
  AdminUserItem,
  AdminUserDetail,
  getAdminEmail,
} from "@/lib/admin-api";

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [drawerActionLoading, setDrawerActionLoading] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Drawer Form States
  const [creditAmount, setCreditAmount] = useState<number>(20);
  const [editPlan, setEditPlan] = useState<string>("free");
  const [editStatus, setEditStatus] = useState<string>("inactive");

  const currentAdminEmail = getAdminEmail();

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        plan_type: planFilter !== "all" ? planFilter : undefined,
        is_admin: adminFilter === "admin" ? true : adminFilter === "regular" ? false : undefined,
      });
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, planFilter, adminFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenDrawer = async (user: AdminUserItem) => {
    setIsDrawerLoading(true);
    setDrawerMessage(null);
    setSelectedUser(null);

    try {
      const detail = await fetchUserDetail(user.id);
      setSelectedUser(detail);
      setEditPlan(detail.plan_type);
      setEditStatus(detail.subscription_status);
      setCreditAmount(detail.credits);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch user details.");
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const handleUpdateCredits = async (mode: "set" | "add") => {
    if (!selectedUser) return;
    setDrawerActionLoading(true);
    setDrawerMessage(null);

    try {
      const res = await updateUserCredits(selectedUser.id, creditAmount, mode);
      setSelectedUser((prev) => (prev ? { ...prev, credits: res.new_credits } : null));
      setDrawerMessage({
        type: "success",
        text: `Credits successfully ${mode === "add" ? "added" : "set"}. New balance: ${res.new_credits}`,
      });
      loadUsers();
    } catch (err: unknown) {
      setDrawerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update credits.",
      });
    } finally {
      setDrawerActionLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedUser) return;
    setDrawerActionLoading(true);
    setDrawerMessage(null);

    try {
      const res = await updateUserPlan(selectedUser.id, editPlan, editStatus);
      setSelectedUser((prev) =>
        prev ? { ...prev, plan_type: res.plan_type, subscription_status: res.subscription_status } : null
      );
      setDrawerMessage({
        type: "success",
        text: `Plan updated to ${res.plan_type} (${res.subscription_status}).`,
      });
      loadUsers();
    } catch (err: unknown) {
      setDrawerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update plan.",
      });
    } finally {
      setDrawerActionLoading(false);
    }
  };

  const handleToggleAdmin = async () => {
    if (!selectedUser) return;
    const targetState = !selectedUser.is_admin;
    const confirmed = window.confirm(
      targetState
        ? `Are you sure you want to promote ${selectedUser.email} to Administrator? They will have full access to this control panel.`
        : `Are you sure you want to remove Administrator privileges from ${selectedUser.email}?`
    );

    if (!confirmed) return;

    setDrawerActionLoading(true);
    setDrawerMessage(null);

    try {
      const res = await toggleUserAdmin(selectedUser.id, targetState);
      setSelectedUser((prev) => (prev ? { ...prev, is_admin: res.is_admin } : null));
      setDrawerMessage({
        type: "success",
        text: `User is now ${res.is_admin ? "an Administrator" : "a regular user"}.`,
      });
      loadUsers();
    } catch (err: unknown) {
      setDrawerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update admin role.",
      });
    } finally {
      setDrawerActionLoading(false);
    }
  };

  const handleDeleteUser = async (targetUser?: AdminUserItem | AdminUserDetail) => {
    const target = targetUser || selectedUser;
    if (!target) return;

    if (target.email === currentAdminEmail) {
      alert("You cannot delete your own admin account.");
      return;
    }

    const confirmed = window.confirm(
      `⚠️ PERMANENT ACCOUNT DELETION\n\nAre you sure you want to permanently delete user:\n${target.email} (ID: #${target.id})?\n\nThis will purge all analysis records, tailored resumes, and credit balances. This action CANNOT be undone.`
    );

    if (!confirmed) return;

    setDrawerActionLoading(true);
    try {
      await deleteUser(target.id);
      if (selectedUser?.id === target.id) {
        setSelectedUser(null);
      }
      loadUsers();
      alert(`User ${target.email} was successfully deleted.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user.";
      if (selectedUser?.id === target.id) {
        setDrawerMessage({ type: "error", text: msg });
      } else {
        alert(msg);
      }
    } finally {
      setDrawerActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search, inspect user profiles, grant credits, change plans, and promote admins.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 self-start sm:self-auto">
          Total Users: {total.toLocaleString()}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by email or name..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Plan filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          {/* Admin filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <select
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins Only</option>
              <option value="regular">Regular Users</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12">#</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Credits</th>
                <th className="py-3.5 px-4">Usage</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading users...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{u.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{u.name || "Unnamed"}</div>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">User</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize ${
                          u.plan_type === "elite"
                            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                            : u.plan_type === "pro"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.plan_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 font-mono">
                      {u.credits}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      <span>{u.analysis_count} analyses</span>
                      <span className="mx-1">·</span>
                      <span>{u.tailored_count} tailored</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDrawer(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100/70 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Manage</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.email === currentAdminEmail}
                          title={u.email === currentAdminEmail ? "Cannot delete self" : "Delete user"}
                          className="p-1.5 rounded-lg border border-rose-200/80 bg-rose-50/50 hover:bg-rose-100 text-rose-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
            <span className="font-semibold text-slate-800">{totalPages}</span> ({total} users)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Drawer */}
      {(selectedUser || isDrawerLoading) && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={() => !drawerActionLoading && setSelectedUser(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full z-10 overflow-y-auto">
            {isDrawerLoading || !selectedUser ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Loading user profile...</span>
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{selectedUser.name || "User Details"}</h2>
                      <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    disabled={drawerActionLoading}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-6 space-y-6 flex-1">
                  {/* Feedback Message */}
                  {drawerMessage && (
                    <div
                      className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
                        drawerMessage.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {drawerMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      )}
                      <span>{drawerMessage.text}</span>
                    </div>
                  )}

                  {/* Section 1: Manage Credits */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Credit Balance
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {selectedUser.credits}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                        className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateCredits("set")}
                        disabled={drawerActionLoading}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
                      >
                        Set Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCredits("add")}
                        disabled={drawerActionLoading}
                        className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
                      >
                        + Add Credits
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Manage Plan & Subscription */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      Subscription Tier & Status
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Plan</label>
                        <select
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro (₹399)</option>
                          <option value="elite">Elite (₹599)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleUpdatePlan}
                      disabled={drawerActionLoading}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
                    >
                      Save Subscription
                    </button>
                  </div>

                  {/* Section 3: Admin Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                          Administrator Privileges
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Grants complete access to this control panel.
                        </p>
                      </div>
                      {selectedUser.is_admin ? (
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAdmin}
                      disabled={
                        drawerActionLoading ||
                        (selectedUser.email === currentAdminEmail && selectedUser.is_admin)
                      }
                      className={`w-full py-2 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                        selectedUser.is_admin
                          ? "border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                          : "border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {selectedUser.email === currentAdminEmail && selectedUser.is_admin
                        ? "Cannot Demote Self (Protected)"
                        : selectedUser.is_admin
                        ? "Demote from Admin"
                        : "Promote to Admin"}
                    </button>
                  </div>

                  {/* Section: Danger Zone */}
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          Danger Zone
                        </span>
                        <p className="text-[11px] text-rose-600/80 mt-0.5">
                          Permanently delete user account and all resume/analysis data.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser()}
                      disabled={drawerActionLoading || selectedUser.email === currentAdminEmail}
                      className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {selectedUser.email === currentAdminEmail ? "Cannot Delete Self" : "Permanently Delete User"}
                    </button>
                  </div>

                  {/* Section 4: Readonly Profile Data */}
                  <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Registered:
                      </span>
                      <span>{new Date(selectedUser.created_at).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" /> Auth Provider:
                      </span>
                      <span className="capitalize">{selectedUser.provider}</span>
                    </div>

                    {selectedUser.phone_number && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> Phone:
                        </span>
                        <span>{selectedUser.phone_number}</span>
                      </div>
                    )}

                    {selectedUser.linkedin_url && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" /> LinkedIn:
                        </span>
                        <a
                          href={selectedUser.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline truncate max-w-[200px]"
                        >
                          {selectedUser.linkedin_url}
                        </a>
                      </div>
                    )}

                    {selectedUser.base_resume_filename && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Master Resume:
                        </span>
                        <span className="font-mono truncate max-w-[200px]">
                          {selectedUser.base_resume_filename}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
