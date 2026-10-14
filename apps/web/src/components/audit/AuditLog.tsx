"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

type AuditEntry = {
  id: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          console.error("Audit log fetch error:", error);
          setError(error.message);
        } else {
          setEntries((data as AuditEntry[]) || []);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">Chargement…</p>;

  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-red-200">
        <p className="text-red-700 text-sm">❌ Erreur : {error}</p>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500 text-sm">
          📭 Aucun log d'audit pour le moment.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <table className="w-full">
        <thead className="border-b-2">
          <tr>
            <th className="text-left p-3 text-sm font-medium">Date</th>
            <th className="text-left p-3 text-sm font-medium">Utilisateur</th>
            <th className="text-left p-3 text-sm font-medium">Action</th>
            <th className="text-left p-3 text-sm font-medium">Entité</th>
            <th className="text-left p-3 text-sm font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                {new Date(e.created_at).toLocaleString("fr-FR")}
              </td>
              <td className="p-3 text-xs text-gray-700">
                {e.user_email || "—"}
              </td>
              <td className="p-3 text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">
                  {e.action}
                </span>
              </td>
              <td className="p-3 text-xs text-gray-600">
                {e.entity_type ? (
                  <>
                    <span className="font-medium">{e.entity_type}</span>
                    {e.entity_id && (
                      <span className="text-gray-400 ml-1">
                        #{e.entity_id.slice(0, 8)}
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="p-3 text-xs text-gray-400 font-mono">
                {e.ip_address || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}