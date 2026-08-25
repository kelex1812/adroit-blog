"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAuditLogRow } from "@/shared/contracts-course-catalog";

/** GET /api/admin/audit → audit log rows, newest first. */
export function useAdminAudit(limit = 100) {
  const [rows, setRows] = useState<AdminAuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load audit log");
      const json = (await res.json()) as { ok: true; data: AdminAuditLogRow[] };
      setRows(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}
