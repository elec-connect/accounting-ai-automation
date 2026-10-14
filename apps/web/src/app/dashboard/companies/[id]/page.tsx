"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type Balance = {
  account_number: string;
  account_label: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type Party = {
  party_name: string;
  party_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type Company = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  balance: number | null;
  total_sales: number | null;
  total_purchases: number | null;
  total_tva_collected: number | null;
  total_tva_deductible: number | null;
  last_calculated_at: string | null;
};

type DocLink = {
  id: string;
  role: string;
  direction: string;
  match_score: number | null;
  confidence: string | null;
  needs_review: boolean;
  duplicate_suspect?: boolean;
  duplicate_reason?: string | null;
  documents: {
    id: string;
    original_filename: string;
    type: string;
    status: string;
    created_at: string;
  } | null;
};

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [balance, setBalance] = useState<Balance[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [documents, setDocuments] = useState<DocLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [rejectingAll, setRejectingAll] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const hasCalculated = useRef(false);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/companies/${id}`);
    const data = await res.json();
    setCompany(data.company);
    setBalance(data.balance ?? []);
    setParties(data.parties ?? []);
    setDocuments(data.documents ?? []);
    setLoading(false);
  }

  async function handleRecalculate() {
    setCalculating(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/companies/${id}/recalculate`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(
          `✅ Calculé : ${data.stats.documents_processed} documents, ${data.stats.entries_created} écritures` +
            (data.stats.documents_needs_review > 0
              ? ` — ⚠️ ${data.stats.documents_needs_review} à vérifier`
              : "") +
            (data.stats.documents_rejected > 0
              ? ` — ❌ ${data.stats.documents_rejected} refusés`
              : "") +
            (data.stats.documents_duplicate_suspects > 0
              ? ` — 🚩 ${data.stats.documents_duplicate_suspects} doublons suspects`
              : "")
        );
        await loadData();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage(
        `❌ Erreur : ${err instanceof Error ? err.message : "inconnue"}`
      );
    } finally {
      setCalculating(false);
    }
  }

  // ⭐ Accepter
  async function handleAccept(linkId: string, filename: string) {
    setProcessing(linkId);
    try {
      const res = await fetch(`/api/document-companies/${linkId}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${filename} accepté`);
        await loadData();
        await handleRecalculate();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setProcessing(null);
    }
  }

  // ⭐ Refuser
  async function handleReject(linkId: string, filename: string) {
    if (
      !confirm(
        `❌ Refuser ${filename} ?\n\nCe document ne sera PAS compté dans la comptabilité.`
      )
    )
      return;

    setProcessing(linkId);
    try {
      const res = await fetch(`/api/document-companies/${linkId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`❌ ${filename} refusé`);
        await loadData();
        await handleRecalculate();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setProcessing(null);
    }
  }

  // ⭐ Récupérer un document refusé
  async function handleRecover(linkId: string, filename: string) {
    if (
      !confirm(
        `🔄 Récupérer ${filename} ?\n\nCe document repassera en "À vérifier" et devra être accepté ou refusé à nouveau.`
      )
    )
      return;

    setProcessing(linkId);
    try {
      const res = await fetch(`/api/document-companies/${linkId}/recover`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`🔄 ${filename} récupéré`);
        await loadData();
        await handleRecalculate();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setProcessing(null);
    }
  }

  // ⭐ Accepter tout
  async function handleAcceptAll() {
    const toAccept = documents.filter(
      (d) => d.needs_review && d.confidence !== "rejected"
    );
    if (toAccept.length === 0) {
      setMessage("ℹ️ Aucun document à accepter");
      return;
    }

    if (
      !confirm(
        `Accepter les ${toAccept.length} document(s) à vérifier ?\n\n` +
          `Ces documents seront comptabilisés.`
      )
    )
      return;

    setAcceptingAll(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/companies/${id}/accept-all`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        await loadData();
        await handleRecalculate();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setAcceptingAll(false);
    }
  }

  // ⭐ Refuser tout
  async function handleRejectAll() {
    const toReject = documents.filter(
      (d) => d.needs_review && d.confidence !== "rejected"
    );
    if (toReject.length === 0) {
      setMessage("ℹ️ Aucun document à refuser");
      return;
    }

    if (
      !confirm(
        `❌ Refuser les ${toReject.length} document(s) à vérifier ?\n\n` +
          `Ces documents ne seront PAS comptabilisés.`
      )
    )
      return;

    setRejectingAll(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/companies/${id}/reject-all`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`❌ ${data.message}`);
        await loadData();
        await handleRecalculate();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setRejectingAll(false);
    }
  }

  // ⭐ Export Excel
  async function handleExportExcel() {
    setExporting('excel');
    setMessage(null);

    try {
      const res = await fetch(`/api/companies/${id}/export/excel`);

      if (!res.ok) {
        const error = await res.json();
        setMessage(`❌ ${error.error}`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = res.headers.get('content-disposition');
      let filename = `bilan_${company?.name ?? 'company'}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage(`✅ Fichier Excel téléchargé`);
    } catch (err) {
      setMessage(`❌ Erreur : ${err instanceof Error ? err.message : 'inconnue'}`);
    } finally {
      setExporting(null);
    }
  }

  // ⭐ Export PDF
  async function handleExportPDF() {
    setExporting('pdf');
    setMessage(null);

    try {
      const res = await fetch(`/api/companies/${id}/export/pdf`);

      if (!res.ok) {
        const error = await res.json();
        setMessage(`❌ ${error.error}`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = res.headers.get('content-disposition');
      let filename = `bilan_${company?.name ?? 'company'}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage(`✅ Fichier PDF téléchargé`);
    } catch (err) {
      setMessage(`❌ Erreur : ${err instanceof Error ? err.message : 'inconnue'}`);
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    hasCalculated.current = false;

    async function init() {
      await loadData();
      if (!hasCalculated.current) {
        hasCalculated.current = true;
        await handleRecalculate();
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-8">Chargement…</div>;
  if (!company) return <div className="p-8">Entreprise introuvable</div>;

  const balanceTotal = Number(company.balance ?? 0);
  const totalSales = Number(company.total_sales ?? 0);
  const totalPurchases = Number(company.total_purchases ?? 0);
  const totalTvaCollected = Number(company.total_tva_collected ?? 0);
  const totalTvaDeductible = Number(company.total_tva_deductible ?? 0);

  const needsReviewDocs = documents.filter(
    (d) => d.needs_review && d.confidence !== "rejected"
  );
  const rejectedDocs = documents.filter((d) => d.confidence === "rejected");
  const needsReviewCount = needsReviewDocs.length;
  const rejectedCount = rejectedDocs.length;

  // ⭐ Doublons suspects
  const duplicateDocs = documents.filter((d) => d.duplicate_suspect === true);
  const duplicateCount = duplicateDocs.length;

  return (
    <main className="p-8 max-w-6xl">
      <Link
        href="/dashboard/companies"
        className="inline-block mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Retour aux entreprises
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏢 {company.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {company.tax_id && (
              <span className="font-mono">MF: {company.tax_id}</span>
            )}
            {company.email && <span>{company.email}</span>}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={exporting !== null || balance.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            title="Télécharger la balance en Excel"
          >
            {exporting === 'excel' ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Export…
              </>
            ) : (
              <>📥 Excel</>
            )}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting !== null || balance.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            title="Télécharger la balance en PDF"
          >
            {exporting === 'pdf' ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Export…
              </>
            ) : (
              <>📄 PDF</>
            )}
          </button>

          <button
            onClick={handleRecalculate}
            disabled={calculating || exporting !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {calculating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Calcul en cours…
              </>
            ) : (
              <>🔄 Recalculer</>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          {message}
        </div>
      )}

      {/* ⭐ NOUVEAU : Bandeau doublons suspects */}
      {duplicateCount > 0 && (
        <Card className="p-4 mb-6 bg-red-50 border-2 border-red-300">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚩</span>
            <div>
              <p className="font-semibold text-red-900">
                {duplicateCount} doublon{duplicateCount > 1 ? "s" : ""} suspect
                {duplicateCount > 1 ? "s" : ""} détecté{duplicateCount > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-red-700">
                Ces documents sont <strong>exclus du calcul</strong> tant que vous
                ne les acceptez ou refusez pas.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Bandeau documents à vérifier */}
      {needsReviewCount > 0 && (
        <Card className="p-4 mb-6 bg-orange-50 border-orange-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-orange-900">
                  {needsReviewCount} document(s) à vérifier
                </p>
                <p className="text-sm text-orange-700">
                  Ces documents ne sont <strong>PAS comptés</strong> dans la balance tant qu'ils ne sont pas acceptés.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptAll}
                disabled={acceptingAll || rejectingAll}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
              >
                {acceptingAll
                  ? "⏳"
                  : `✅ Accepter tout (${needsReviewCount})`}
              </button>
              <button
                onClick={handleRejectAll}
                disabled={acceptingAll || rejectingAll}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
              >
                {rejectingAll
                  ? "⏳"
                  : `❌ Refuser tout (${needsReviewCount})`}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Bandeau documents refusés */}
      {rejectedCount > 0 && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="font-semibold text-red-900">
                {rejectedCount} document(s) refusé(s)
              </p>
              <p className="text-sm text-red-700">
                Ces documents ne sont PAS comptés dans la comptabilité.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cartes résumé */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Ventes</p>
          <p className="text-2xl font-bold text-green-700">
            {totalSales.toFixed(3)} DT
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Achats</p>
          <p className="text-2xl font-bold text-orange-700">
            {totalPurchases.toFixed(3)} DT
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">TVA</p>
          <p className="text-sm font-bold text-gray-700">
            +{totalTvaCollected.toFixed(3)}
            <br />
            -{totalTvaDeductible.toFixed(3)}
          </p>
        </Card>
        <Card
          className={`p-4 ${
            balanceTotal >= 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase mb-1">Solde</p>
          <p
            className={`text-2xl font-bold ${
              balanceTotal >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {balanceTotal.toFixed(3)} DT
          </p>
        </Card>
      </div>

      {/* Balance */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📋 Balance</h2>
        {balance.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune écriture.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Compte</th>
                <th className="text-left p-2">Libellé</th>
                <th className="text-right p-2">Débit</th>
                <th className="text-right p-2">Crédit</th>
                <th className="text-right p-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((b) => (
                <tr key={b.account_number} className="border-b">
                  <td className="p-2 font-mono">{b.account_number}</td>
                  <td className="p-2">{b.account_label}</td>
                  <td className="p-2 text-right">
                    {Number(b.total_debit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {Number(b.total_credit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right font-semibold">
                    {b.balance >= 0 ? (
                      <span className="text-green-700">
                        {Number(b.balance).toFixed(3)} DT (Débit)
                      </span>
                    ) : (
                      <span className="text-blue-700">
                        {Math.abs(Number(b.balance)).toFixed(3)} DT (Crédit)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Partenaires */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          👥 Clients et fournisseurs
        </h2>
        {parties.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun partenaire.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Partie</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Débit</th>
                <th className="text-right p-2">Crédit</th>
                <th className="text-right p-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.party_name} className="border-b">
                  <td className="p-2 font-medium">{p.party_name}</td>
                  <td className="p-2">
                    {p.party_type === "client" ? "👤 Client" : "🏢 Fournisseur"}
                  </td>
                  <td className="p-2 text-right">
                    {Number(p.total_debit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {Number(p.total_credit ?? 0).toFixed(3)} DT
                  </td>
                  <td
                    className={`p-2 text-right font-semibold ${
                      p.balance >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {Number(p.balance ?? 0).toFixed(3)} DT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Documents */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          📄 Documents liés ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun document.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Fichier</th>
                <th className="text-left p-2">Rôle</th>
                <th className="text-left p-2">Sens</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Statut</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const isRejected = d.confidence === "rejected";
                const isPending = d.needs_review && !isRejected;
                const isDuplicateSuspect = d.duplicate_suspect === true;

                return (
                  <tr
                    key={d.id}
                    className={`border-b transition-colors ${
                      isDuplicateSuspect
                        ? "bg-red-100 border-l-4 border-l-red-500 hover:bg-red-200"
                        : isRejected
                        ? "opacity-60 hover:bg-gray-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {isDuplicateSuspect && (
                          <span
                            className="text-red-600 text-lg"
                            title={d.duplicate_reason || "Doublon suspect"}
                          >
                            🚩
                          </span>
                        )}
                        {d.documents ? (
                          <Link
                            href={`/dashboard/documents/${d.documents.id}`}
                            className={`hover:underline ${
                              isDuplicateSuspect
                                ? "text-red-700 font-semibold"
                                : "text-blue-600"
                            }`}
                          >
                            {d.documents.original_filename}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </div>
                      {isDuplicateSuspect && d.duplicate_reason && (
                        <p className="text-xs text-red-600 mt-1 italic">
                          {d.duplicate_reason}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {d.role === "issuer" ? "📤 Émetteur" : "📥 Destinataire"}
                    </td>
                    <td className="p-2">
                      {d.direction === "issued" ? "Vente" : "Achat"}
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          isDuplicateSuspect
                            ? "bg-red-200 text-red-900"
                            : isRejected
                            ? "bg-red-100 text-red-800"
                            : d.confidence === "high"
                            ? "bg-green-100 text-green-800"
                            : d.confidence === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : d.confidence === "low"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {isRejected ? "❌" : `${d.match_score ?? 0}/3`}
                      </span>
                    </td>
                    <td className="p-2">
                      {isDuplicateSuspect ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-200 text-red-900 border border-red-400">
                          🚩 Doublon suspect
                        </span>
                      ) : isRejected ? (
                        <span className="text-xs text-red-700 font-semibold">
                          ❌ Refusé
                        </span>
                      ) : isPending ? (
                        <span className="text-xs text-orange-700 font-semibold">
                          ⚠️ À vérifier
                        </span>
                      ) : (
                        <span className="text-xs text-green-700">✅ OK</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {/* En attente ou Doublon suspect : Accepter + Refuser */}
                        {(isPending || isDuplicateSuspect) && !isRejected && (
                          <>
                            <button
                              onClick={() =>
                                handleAccept(
                                  d.id,
                                  d.documents?.original_filename ?? ""
                                )
                              }
                              disabled={processing === d.id}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              title="Accepter"
                            >
                              {processing === d.id ? "⏳" : "✅"}
                            </button>
                            <button
                              onClick={() =>
                                handleReject(
                                  d.id,
                                  d.documents?.original_filename ?? ""
                                )
                              }
                              disabled={processing === d.id}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              title="Refuser"
                            >
                              {processing === d.id ? "⏳" : "❌"}
                            </button>
                          </>
                        )}

                        {/* Refusé : Récupérer */}
                        {isRejected && (
                          <button
                            onClick={() =>
                              handleRecover(
                                d.id,
                                d.documents?.original_filename ?? ""
                              )
                            }
                            disabled={processing === d.id}
                            className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                            title="Récupérer (remettre en attente)"
                          >
                            {processing === d.id ? "⏳" : "🔄 Récupérer"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}