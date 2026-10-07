"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AuditEntry = {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  created_at: string;
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("audit_log").select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (entries.length === 0) return <p className="text-gray-500">No audit entries.</p>;

  return (
    <Card>
      <table className="w-full">
        <thead className="border-b-2">
          <tr>
            <th className="text-left p-3 text-sm font-medium">When</th>
            <th className="text-left p-3 text-sm font-medium">Action</th>
            <th className="text-left p-3 text-sm font-medium">Resource</th>
            <th className="text-left p-3 text-sm font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              <td className="p-3 text-xs text-gray-500">
                {new Date(e.created_at).toLocaleString()}
              </td>
              <td className="p-3 text-sm font-medium">{e.action}</td>
              <td className="p-3 text-xs text-gray-600">
                {e.resource_type}: {e.resource_id?.slice(0, 8) || "-"}
              </td>
              <td className="p-3">
                <Badge variant={e.status === "success" ? "success" : "warning"}>
                  {e.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
