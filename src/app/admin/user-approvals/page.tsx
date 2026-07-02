"use client";

import { authFetch } from "@/lib/auth-fetch";
import type { ApprovalStatus } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  position: string | null;
  role: "admin" | "teacher";
  approval_status: ApprovalStatus;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
};

export default function UserApprovalsPage() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApprovalStatus>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<ApprovalStatus, number>>({
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  });
  const [bulkRole, setBulkRole] = useState<"teacher" | "admin">("teacher");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const allChecked = rows.length > 0 && selectedIds.length === rows.length;

  const load = async (nextPage = page) => {
    setBusy(true);
    setStatus("");

    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(pageSize),
      status: statusFilter,
    });
    if (search.trim()) params.set("q", search.trim());
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    const res = await authFetch(`/api/admin/user-approvals?${params.toString()}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error ?? "목록 조회 실패");
      return;
    }

    setRows(json.items ?? []);
    setTotal(json.total ?? 0);
    setPage(json.page ?? nextPage);
    setStatusCounts(
      json.statusCounts ?? {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      }
    );
    setSelectedIds([]);
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    setPage(1);
    await load(1);
  };

  const runBulkAction = async (action: "APPROVE" | "REJECT", ids: string[]) => {
    if (ids.length === 0) {
      setStatus("선택된 사용자가 없습니다.");
      return;
    }
    setBusy(true);
    setStatus("");

    const res = await authFetch("/api/admin/user-approvals", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIds: ids,
        action,
        role: bulkRole,
        reason: reason.trim() || null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error ?? "처리 실패");
      return;
    }

    setReason("");
    await load();
  };

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allChecked ? [] : rows.map((row) => row.id));
  };

  const statusBadgeClass = (approvalStatus: ApprovalStatus) => {
    if (approvalStatus === "APPROVED") return "bg-emerald-100 text-emerald-700";
    if (approvalStatus === "REJECTED") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  };

  const statusLabel = (approvalStatus: ApprovalStatus) => {
    if (approvalStatus === "APPROVED") return "승인";
    if (approvalStatus === "REJECTED") return "반려";
    return "대기";
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">회원관리 &gt; 가입 승인 관리</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        관리자 승인(`APPROVED`) 계정만 서비스 접근이 가능합니다.
      </p>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-6">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | ApprovalStatus)}
        >
          <option value="ALL">상태 전체</option>
          <option value="PENDING">대기</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
        </select>
        <input
          type="date"
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          type="date"
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
          type="button"
          onClick={applyFilters}
          disabled={busy}
        >
          조회
        </button>
      </section>

      <section className="grid gap-2 rounded-xl border p-4 text-sm dark:border-zinc-800 md:grid-cols-3">
        <p>대기: {statusCounts.PENDING}</p>
        <p>승인: {statusCounts.APPROVED}</p>
        <p>반려: {statusCounts.REJECTED}</p>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-6">
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={bulkRole}
          onChange={(e) => setBulkRole(e.target.value as "teacher" | "admin")}
        >
          <option value="teacher">승인 역할: 교사</option>
          <option value="admin">승인 역할: 관리자</option>
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-3"
          placeholder="반려 사유 (선택)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-60"
          type="button"
          onClick={() => runBulkAction("APPROVE", selectedIds)}
          disabled={busy}
        >
          선택 승인
        </button>
        <button
          className="rounded bg-rose-600 px-3 py-2 text-white disabled:opacity-60"
          type="button"
          onClick={() => runBulkAction("REJECT", selectedIds)}
          disabled={busy}
        >
          선택 반려
        </button>
      </section>

      {status ? <p className="text-sm text-rose-500">{status}</p> : null}

      <section className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">
                <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">연락처</th>
              <th className="px-3 py-2">소속/직책</th>
              <th className="px-3 py-2">가입일시</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-zinc-500" colSpan={8}>
                  조회 결과가 없습니다.
                </td>
              </tr>
            ) : null}
            {rows.map((u) => (
              <tr key={u.id} className="border-b last:border-0 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelection(u.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{u.full_name}</td>
                <td className="px-3 py-2">{u.email ?? "-"}</td>
                <td className="px-3 py-2">{u.phone ?? "-"}</td>
                <td className="px-3 py-2">
                  {[u.organization, u.position].filter(Boolean).join(" / ") || "-"}
                </td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(u.approval_status)}`}
                  >
                    {statusLabel(u.approval_status)}
                  </span>
                  {u.approval_status === "REJECTED" && u.rejection_reason ? (
                    <p className="mt-1 text-xs text-rose-500">{u.rejection_reason}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                      type="button"
                      disabled={busy}
                      onClick={() => runBulkAction("APPROVE", [u.id])}
                    >
                      승인
                    </button>
                    <button
                      className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                      type="button"
                      disabled={busy}
                      onClick={() => runBulkAction("REJECT", [u.id])}
                    >
                      반려
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          총 {total}건 / {page}페이지 / 페이지당 {pageSize}건
        </p>
        <div className="flex gap-2">
          <button
            className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => load(page - 1)}
          >
            이전
          </button>
          <button
            className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            type="button"
            disabled={page >= totalPages || busy}
            onClick={() => load(page + 1)}
          >
            다음
          </button>
        </div>
      </section>
    </main>
  );
}

