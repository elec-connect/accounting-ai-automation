"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ExceptionCardProps = {
  exception: {
    id: string;
    document_id: string;
    reason: string;
    severity: string;
    status: string;
    created_at: string;
  };
  document?: {
    id: string;
    original_filename?: string | null;
    confidence_score?: number | null;
    summary?: string | null;
    sender_email?: string | null;
  } | null;
  canResolve: boolean;
  onResolve: (id: string, documentId: string) => void;
};

export function ExceptionCard({
  exception,
  document,
  canResolve,
  onResolve,
}: ExceptionCardProps) {
  const confidence = document?.confidence_score ?? null;

  return (
    <Card className="p-4 mb-3 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Partie gauche : infos */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge
              variant={exception.severity === "high" ? "error" : "warning"}
            >
              {exception.severity}
            </Badge>
            <Badge
              variant={exception.status === "open" ? "warning" : "success"}
            >
              {exception.status}
            </Badge>
            {confidence != null && (
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  confidence >= 90
                    ? "bg-green-100 text-green-800"
                    : confidence >= 70
                    ? "bg-orange-100 text-orange-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                🤖 {confidence.toFixed(0)}%
              </span>
            )}
          </div>

          {/* Lien vers le document */}
          <Link
            href={`/dashboard/documents/${exception.document_id}`}
            className="text-blue-600 hover:underline font-semibold text-sm block truncate"
          >
            📄{" "}
            {document?.original_filename || exception.document_id.slice(0, 12)}
          </Link>

          {/* Raison */}
          <p className="text-sm text-gray-700 mt-2">{exception.reason}</p>

          {/* Résumé */}
          {document?.summary && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              {document.summary}
            </p>
          )}

          {/* Métadonnées */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>
              📅 {new Date(exception.created_at).toLocaleString("fr-FR")}
            </span>
            {document?.sender_email && (
              <span className="truncate">✉️ {document.sender_email}</span>
            )}
          </div>
        </div>

        {/* Partie droite : actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Link
            href={`/dashboard/exceptions/${exception.id}`}
            className="text-xs text-center px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
          >
            🔍 Détails
          </Link>

          {exception.status === "open" && canResolve && (
            <Button
              onClick={() => onResolve(exception.id, exception.document_id)}
              className="text-xs py-1.5 px-3 bg-green-600 hover:bg-green-700"
            >
              ✅ Approuver
            </Button>
          )}

          {exception.status === "open" && !canResolve && (
            <span className="text-xs text-gray-400 text-center px-3">
              Read-only
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}