"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

type Answer = {
  answer: string;
  model_used?: string;
  tool_calls?: ToolCall[];
  error?: string;
};

const TOOL_LABELS: Record<string, string> = {
  search_invoices: "🔍 Recherche factures",
  get_stats: "📊 Statistiques",
  search_exceptions: "⚠️ Exceptions",
  get_supplier_summary: "🏢 Fournisseurs",
};

const SUGGESTIONS = [
  "Factures supérieures à 1000 DT",
  "Combien de factures au total ?",
  "Montre-moi les exceptions",
  "Top fournisseurs",
  "Factures d'Elec-Connect",
  "Factures en octobre 2026",
];

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(q?: string) {
    const finalQuestion = q ?? question;
    if (!finalQuestion.trim()) return;

    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion }),
      });

      const data = await res.json();

      if (res.ok) {
        setAnswer(data);
      } else {
        setAnswer({
          answer: `❌ ${data.error}`,
          tool_calls: [],
        });
      }
    } catch (err) {
      setAnswer({
        answer: `❌ Erreur réseau : ${
          err instanceof Error ? err.message : "inconnue"
        }`,
        tool_calls: [],
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(s: string) {
    setQuestion(s);
    handleAsk(s);
  }

  return (
    <main className="p-8 max-w-4xl space-y-6">
      {/* Formulaire */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">🤖 Ask AI</h2>
        <div className="flex gap-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Posez votre question sur vos documents..."
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            disabled={loading}
          />
          <Button onClick={() => handleAsk()} disabled={loading}>
            {loading ? "Analyse..." : "Demander"}
          </Button>
        </div>

        {/* Suggestions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 disabled:opacity-50 transition"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Réponse */}
      {answer && (
        <Card className="p-6">
          {/* Tools utilisés */}
          {answer.tool_calls && answer.tool_calls.length > 0 && (
            <div className="mb-4 pb-4 border-b">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                🔧 Outils utilisés :
              </p>
              <div className="flex flex-wrap gap-2">
                {answer.tool_calls.map((tc, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
                    title={JSON.stringify(tc.args)}
                  >
                    {TOOL_LABELS[tc.name] ?? tc.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contenu de la réponse */}
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={answer.answer} />
          </div>

          {/* Modèle utilisé */}
          {answer.model_used && (
            <p className="mt-4 text-xs text-gray-400">
              Modèle : {answer.model_used}
            </p>
          )}
        </Card>
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RENDERER MARKDOWN SIMPLE (sans dépendance)
// ═══════════════════════════════════════════════════════════════

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  function flushTable(key: number) {
    if (tableBuffer.length === 0) return;

    const rows = tableBuffer
      .filter((l) => !/^\s*\|?\s*[-:|\s]+\s*\|?\s*$/.test(l))
      .map((l) =>
        l
          .split("|")
          .map((c) => c.trim())
          .filter((_, i, arr) => !(i === 0 && arr[0] === "") && !(i === arr.length - 1 && arr[arr.length - 1] === ""))
      );

    if (rows.length === 0) {
      tableBuffer = [];
      inTable = false;
      return;
    }

    const [header, ...body] = rows;

    elements.push(
      <div key={`table-${key}`} className="overflow-x-auto my-4">
        <table className="w-full text-sm border rounded">
          <thead className="bg-gray-50">
            <tr>
              {header.map((cell, i) => (
                <th key={i} className="text-left p-2 border-b font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50">
                {row.map((cell, ci) => (
                  <td key={ci} className="p-2 border-b">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    tableBuffer = [];
    inTable = false;
  }

  lines.forEach((line, i) => {
    // Détection tableau
    if (line.trim().startsWith("|")) {
      inTable = true;
      tableBuffer.push(line);
      return;
    } else if (inTable) {
      flushTable(i);
    }

    // Titres
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg font-bold mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-bold mt-4 mb-2">
          {line.slice(3)}
        </h2>
      );
      return;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h1>
      );
      return;
    }

    // Listes
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          <InlineMarkdown text={line.slice(2)} />
        </li>
      );
      return;
    }

    // Paragraphe
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      return;
    }

    elements.push(
      <p key={i} className="my-1">
        <InlineMarkdown text={line} />
      </p>
    );
  });

  if (inTable) flushTable(lines.length);

  return <>{elements}</>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Gras **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}