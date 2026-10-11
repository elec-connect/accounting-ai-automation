"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setAnswer(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <Card>
        <div className="flex gap-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What invoices over £5,000 did we receive?"
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          />
          <Button onClick={handleAsk} disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Examples: "What invoices over £5,000 in October?" · "Show me exceptions"
        </p>
      </Card>

      {answer && (
        <Card>
          <h2 className="text-lg font-bold mb-4">Answer</h2>
          <p className="whitespace-pre-wrap mb-4">{answer.answer}</p>
          {answer.confidence !== undefined && (
            <p className="text-xs text-gray-500">
              Confidence: {((answer.confidence || 0) * 100).toFixed(0)}% ·
              Model: {answer.model_used || "-"}
            </p>
          )}
        </Card>
      )}
    </main>
  );
}