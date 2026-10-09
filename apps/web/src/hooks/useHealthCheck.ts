"use client";

import { useCallback, useEffect, useState } from "react";

export type HealthCheck = {
  key: string;
  label: string;
  scope: "env" | "settings";
  critical: boolean;
  ok: boolean;
};

export type HealthSummary = {
  total: number;
  ok: number;
  missing: number;
  criticalMissing: number;
  healthy: boolean;
};

type HealthState = {
  checks: HealthCheck[];
  summary: HealthSummary | null;
  loading: boolean;
  error: string | null;
};

export function useHealthCheck(pollIntervalMs = 60_000) {
  const [state, setState] = useState<HealthState>({
    checks: [],
    summary: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/health", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setState({
        checks: json.checks ?? [],
        summary: json.summary ?? null,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Erreur inconnue",
      }));
    }
  }, []);

  useEffect(() => {
    load();
    if (pollIntervalMs > 0) {
      const id = setInterval(load, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [load, pollIntervalMs]);

  return { ...state, reload: load };
}