"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

type Metrics = {
  total: number;
  delivered: number;
  exceptions: number;
  automationRate: number;
};

export function MetricsCards() {
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    delivered: 0,
    exceptions: 0,
    automationRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("documents").select("status").then(({ data }) => {
      const docs = data || [];
      const total = docs.length;
      const delivered = docs.filter((d) => d.status === "delivered").length;
      const exceptions = docs.filter((d) => d.status === "exception").length;
      setMetrics({
        total,
        delivered,
        exceptions,
        automationRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-gray-500">Loading metrics...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <p className="text-sm text-gray-500">Total Documents</p>
        <p className="text-3xl font-bold mt-2">{metrics.total}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Delivered</p>
        <p className="text-3xl font-bold text-green-600 mt-2">{metrics.delivered}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Exceptions</p>
        <p className="text-3xl font-bold text-yellow-600 mt-2">{metrics.exceptions}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Automation Rate</p>
        <p className="text-3xl font-bold text-blue-600 mt-2">{metrics.automationRate}%</p>
      </Card>
    </div>
  );
}
