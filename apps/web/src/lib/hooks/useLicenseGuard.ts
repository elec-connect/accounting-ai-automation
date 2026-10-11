"use client";

import { useEffect, useState } from "react";

export type LicenseStatus = {
  valid: boolean;
  reason?: "no_license" | "expired" | "revoked" | "suspended";
  license?: {
    license_key: string;
    duration_type: string;
    activated_at: string;
    expires_at: string | null;
  };
  daysLeft?: number | null;
  loading: boolean;
};

export function useLicenseGuard(): LicenseStatus {
  const [status, setStatus] = useState<LicenseStatus>({
    valid: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/licenses/check")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setStatus({ ...data, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ valid: false, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}