import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════
//  LECTURE DE LA CLÉ GROQ (DB prioritaire, fallback env)
// ═══════════════════════════════════════════════════════════════

async function getGroqApiKey(supabase: any): Promise<string | null> {
  // 1. Essayer la table settings (priorité)
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "groq_api_key")
      .maybeSingle();

    if (data?.value && data.value.trim().length > 0) {
      return data.value.trim();
    }
  } catch {
    // ignore
  }

  // 2. Fallback sur process.env
  return process.env.GROQ_API_KEY ?? null;
}

// ═══════════════════════════════════════════════════════════════
//  DÉFINITION DES TOOLS (Function Calling)
// ═══════════════════════════════════════════════════════════════

const tools = [
  {
    type: "function",
    function: {
      name: "search_invoices",
      description:
        "Recherche des factures dans la base de données. Utilise cet outil quand l'utilisateur demande des factures filtrées par montant, date, fournisseur ou statut.",
      parameters: {
        type: "object",
        properties: {
          min_amount: {
            type: "number",
            description: "Montant minimum TTC en DT",
          },
          max_amount: {
            type: "number",
            description: "Montant maximum TTC en DT",
          },
          supplier_name: {
            type: "string",
            description: "Nom du fournisseur (recherche partielle)",
          },
          date_from: {
            type: "string",
            description: "Date de début (format YYYY-MM-DD)",
          },
          date_to: {
            type: "string",
            description: "Date de fin (format YYYY-MM-DD)",
          },
          status: {
            type: "string",
            description: "Statut du document",
            enum: ["all", "approved", "exception", "delivered", "rejected"],
          },
          limit: {
            type: "number",
            description: "Nombre maximum de résultats (défaut: 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stats",
      description:
        "Récupère les statistiques globales : nombre total de documents, montant total TTC. Utilise cet outil pour des questions comme 'combien de factures ?', 'quel est le total des factures ?'.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "Période d'analyse",
            enum: ["all", "month", "year"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_exceptions",
      description:
        "Liste les documents en exception (nécessitant une vérification manuelle). Utilise cet outil pour 'montre-moi les exceptions', 'quels documents sont à vérifier ?'.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Nombre maximum de résultats (défaut: 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_supplier_summary",
      description:
        "Groupe les factures par fournisseur avec totaux. Utilise cet outil pour 'top fournisseurs', 'qui sont mes principaux fournisseurs ?', 'répartition par fournisseur'.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Nombre de fournisseurs à afficher (défaut: 10)",
          },
        },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
//  IMPLÉMENTATION DES TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchInvoices(
  supabase: any,
  args: {
    min_amount?: number;
    max_amount?: number;
    supplier_name?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    limit?: number;
  }
) {
  let query = supabase
    .from("documents")
    .select(
      `
      id,
      original_filename,
      status,
      created_at,
      extractions (
        extracted_fields
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 20);

  if (args.status && args.status !== "all") {
    query = query.eq("status", args.status);
  }

  if (args.date_from) {
    query = query.gte("created_at", args.date_from);
  }

  if (args.date_to) {
    query = query.lte("created_at", args.date_to);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  let results = (data ?? []).map((doc: any) => {
    const f = doc.extractions?.[0]?.extracted_fields ?? {};
    return {
      id: doc.id,
      filename: doc.original_filename,
      status: doc.status,
      created_at: doc.created_at,
      supplier: f.supplier_name ?? "—",
      amount: f.total_amount_ttc ?? null,
      date: f.invoice_date ?? null,
    };
  });

  if (args.min_amount != null) {
    results = results.filter(
      (r: any) => r.amount != null && Number(r.amount) >= args.min_amount!
    );
  }

  if (args.max_amount != null) {
    results = results.filter(
      (r: any) => r.amount != null && Number(r.amount) <= args.max_amount!
    );
  }

  if (args.supplier_name) {
    const search = args.supplier_name.toLowerCase();
    results = results.filter((r: any) =>
      String(r.supplier).toLowerCase().includes(search)
    );
  }

  return {
    count: results.length,
    invoices: results,
  };
}

async function getStats(supabase: any, args: { period?: string }) {
  let query = supabase
    .from("documents")
    .select("id, status, created_at, extractions(extracted_fields)");

  if (args.period === "month") {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    query = query.gte("created_at", monthAgo.toISOString());
  } else if (args.period === "year") {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    query = query.gte("created_at", yearAgo.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const docs = data ?? [];

  const totalAmount = docs.reduce((sum: number, doc: any) => {
    const amount = doc.extractions?.[0]?.extracted_fields?.total_amount_ttc;
    return sum + (Number(amount) || 0);
  }, 0);

  const byStatus: Record<string, number> = {};
  for (const doc of docs) {
    byStatus[doc.status] = (byStatus[doc.status] ?? 0) + 1;
  }

  return {
    period: args.period ?? "all",
    total_documents: docs.length,
    total_amount_ttc: Number(totalAmount.toFixed(2)),
    by_status: byStatus,
  };
}

async function searchExceptions(supabase: any, args: { limit?: number }) {
  const { data, error } = await supabase
    .from("exceptions")
    .select(
      `
      id,
      document_id,
      reason,
      severity,
      status,
      created_at,
      documents (
        original_filename
      )
    `
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 20);

  if (error) {
    return { error: error.message };
  }

  return {
    count: data?.length ?? 0,
    exceptions: (data ?? []).map((ex: any) => ({
      id: ex.id,
      document_id: ex.document_id,
      filename: ex.documents?.original_filename ?? "—",
      reason: ex.reason,
      severity: ex.severity,
      created_at: ex.created_at,
    })),
  };
}

async function getSupplierSummary(supabase: any, args: { limit?: number }) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, extractions(extracted_fields)");

  if (error) {
    return { error: error.message };
  }

  const supplierMap: Record<string, { count: number; total: number }> = {};

  for (const doc of data ?? []) {
    const f = doc.extractions?.[0]?.extracted_fields ?? {};
    const supplier = String(f.supplier_name ?? "Inconnu").trim();
    const amount = Number(f.total_amount_ttc) || 0;

    if (!supplierMap[supplier]) {
      supplierMap[supplier] = { count: 0, total: 0 };
    }
    supplierMap[supplier].count += 1;
    supplierMap[supplier].total += amount;
  }

  const sorted = Object.entries(supplierMap)
    .map(([name, stats]) => ({
      supplier: name,
      count: stats.count,
      total: Number(stats.total.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, args.limit ?? 10);

  return {
    count: sorted.length,
    suppliers: sorted,
  };
}

// ═══════════════════════════════════════════════════════════════
//  HELPER — Appel Groq
// ═══════════════════════════════════════════════════════════════

async function callGroq(apiKey: string, messages: any[], tools: any[]) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages,
        tools,
        tool_choice: "auto",
        reasoning_effort: "low",
        max_tokens: 2000,
        temperature: 0.1,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq error: ${response.status} - ${errText}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Question
    const body = await request.json();
    const { question } = body as { question: string };

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "Question requise" },
        { status: 400 }
      );
    }

    // 3. ⭐ Récupérer la clé Groq depuis la DB ou env
    const apiKey = await getGroqApiKey(supabase);
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Clé API Groq non configurée. Ajoutez-la dans Paramètres → Configuration.",
        },
        { status: 400 }
      );
    }

    // 4. Conversation initiale
    const messages: any[] = [
      {
        role: "system",
        content: `Tu es un assistant comptable. Tu as accès à la base de données de factures via des outils.

RÈGLES :
- Utilise les outils pour répondre aux questions sur les factures, statistiques, exceptions et fournisseurs.
- Si l'utilisateur demande des factures filtrées, appelle search_invoices avec les bons paramètres.
- Pour les totaux/nombres, utilise get_stats.
- Pour les exceptions, utilise search_exceptions.
- Pour les fournisseurs, utilise get_supplier_summary.
- Réponds en français, de manière concise et factuelle.
- Formate les listes en tableaux Markdown quand c'est pertinent.
- Ne jamais inventer de données.`,
      },
      {
        role: "user",
        content: question,
      },
    ];

    // 5. Premier appel à Groq
    const firstResponse = await callGroq(apiKey, messages, tools);
    const assistantMessage = firstResponse.choices[0].message;

    // 6. Pas de tool call → réponse directe
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return NextResponse.json({
        answer: assistantMessage.content || "Aucune réponse générée.",
        model_used: firstResponse.model,
        tool_calls: [],
      });
    }

    // 7. Exécuter les tool calls
    messages.push(assistantMessage);

    const executedTools: Array<{ name: string; args: any }> = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let args: any = {};

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      console.log(`🔧 ${toolName} appelé avec:`, args);
      executedTools.push({ name: toolName, args });

      let result: any;

      switch (toolName) {
        case "search_invoices":
          result = await searchInvoices(supabase, args);
          break;
        case "get_stats":
          result = await getStats(supabase, args);
          break;
        case "search_exceptions":
          result = await searchExceptions(supabase, args);
          break;
        case "get_supplier_summary":
          result = await getSupplierSummary(supabase, args);
          break;
        default:
          result = { error: `Outil inconnu: ${toolName}` };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // 8. Appel final à Groq avec les résultats
    const finalResponse = await callGroq(apiKey, messages, tools);
    const finalMessage = finalResponse.choices[0].message;

    return NextResponse.json({
      answer: finalMessage.content || "Aucune réponse générée.",
      model_used: finalResponse.model,
      tool_calls: executedTools,
    });
  } catch (error) {
    console.error("Ask error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}