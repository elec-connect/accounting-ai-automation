"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/auth/use-profile";
import { can } from "@/lib/auth/permissions";

type Exception = {
  id: string;
  document_id: string;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
};

export function ExceptionList() {
  const { profile } = useProfile();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);

  const canResolve = can(profile?.role, "exceptions:resolve");

  async function loadExceptions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("exceptions")
      .select("*")
      .order("created_at", { ascending: false });
    setExceptions(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadExceptions();
  }, []);

  async function resolve(id: string, documentId: string) {
    const supabase = createClient();

    await supabase
      .from("exceptions")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    await supabase
      .from("documents")
      .update({ status: "approved" })
      .eq("id", documentId);

    await loadExceptions();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (exceptions.length === 0)
    return <p className="text-gray-500">No exceptions.</p>;

  return (
    <Card>
      {!canResolve && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          You have <strong>read-only access</strong>. Only accountants and
          admins can resolve exceptions.
        </div>
      )}

      <table className="w-full">
        <thead className="border-b-2">
          <tr>
            <th className="text-left p-3 text-sm font-medium">Reason</th>
            <th className="text-left p-3 text-sm font-medium">Severity</th>
            <th className="text-left p-3 text-sm font-medium">Status</th>
            <th className="text-left p-3 text-sm font-medium">Created</th>
            <th className="text-left p-3 text-sm font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {exceptions.map((e) => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              {/* ═══════════════════════════════════════════════
                  LIEN VERS LA PAGE DÉTAIL DE L'EXCEPTION
                  ═══════════════════════════════════════════════ */}
              <td className="p-3 text-sm">
                <Link
                  href={`/dashboard/exceptions/${e.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {e.reason}
                </Link>
                <div className="text-xs text-gray-400 mt-1">
                  Doc ID : {e.document_id.slice(0, 8)}…
                </div>
              </td>
              <td className="p-3">
                <Badge variant={e.severity === "high" ? "error" : "warning"}>
                  {e.severity}
                </Badge>
              </td>
              <td className="p-3">
                <Badge variant={e.status === "open" ? "warning" : "success"}>
                  {e.status}
                </Badge>
              </td>
              <td className="p-3 text-sm text-gray-500">
                {new Date(e.created_at).toLocaleString("fr-FR")}
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {/* Lien vers le détail */}
                  <Link
                    href={`/dashboard/exceptions/${e.id}`}
                    className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    🔍 Détails
                  </Link>

                  {/* Bouton resolve (existant) */}
                  {e.status === "open" && canResolve ? (
                    <Button
                      onClick={() => resolve(e.id, e.document_id)}
                      className="text-xs py-1 px-2"
                    >
                      ✅ Resolve
                    </Button>
                  ) : e.status === "open" ? (
                    <span className="text-xs text-gray-400">Read-only</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}