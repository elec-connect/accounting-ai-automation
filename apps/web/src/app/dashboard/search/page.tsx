"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";

type SearchResult = {
  id: string;
  filename: string;
  type: string;
  status: string;
  created_at: string;
  excerpt: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Search" />
        <main className="p-8 max-w-4xl">
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">🔍 Recherche dans les documents</h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un mot-clé (ex: Huilerie, adem, 1800)..."
                className="flex-1 border rounded px-3 py-2"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Recherche..." : "Rechercher"}
              </button>
            </form>
          </Card>

          {searched && (
            <Card className="p-6">
              <h3 className="font-bold mb-4">
                {results.length} résultat{results.length > 1 ? "s" : ""}
              </h3>
              {results.length === 0 && (
                <p className="text-gray-500">Aucun résultat trouvé.</p>
              )}
              <div className="space-y-4">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/documents/${r.id}`}
                    className="block p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{r.filename}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}