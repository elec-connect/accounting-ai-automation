'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadButton } from './UploadButton';

type Document = {
  id: string;
  type: string;
  status: string;
  original_filename: string;
  sender_email: string;
  created_at: string;
  summary: string | null;
};

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  received: 'info',
  extracted: 'info',
  auto_approved: 'success',
  review_needed: 'warning',
  approved: 'success',
  pending_approval: 'warning',
  delivered: 'success',
  exception: 'error',
};

export function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function handleSendEmail() {
    const email = prompt("Entrez l'adresse email du destinataire :");
    if (!email) return;

    setSending(true);
    try {
      const res = await fetch('/api/documents/report/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert('Erreur : ' + result.error);
      } else {
        alert('✅ Email envoyé avec succès !');
      }
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Inconnue'));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string, filename: string) {
  const confirmed = confirm(
    `⚠️ Supprimer définitivement « ${filename} » ?\n\n` +
    `Cette action est irréversible.\n` +
    `Le document, son extraction et son fichier seront supprimés.`
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`/api/documents/${id}/delete`, {
      method: 'DELETE',
    });

    const result = await res.json();

    if (!res.ok) {
      alert('❌ Erreur : ' + result.error);
    } else {
      alert('✅ Document supprimé.');
      loadDocuments();
    }
  } catch (err) {
    alert('Erreur : ' + (err instanceof Error ? err.message : 'Inconnue'));
  }
}

  const loadDocuments = useCallback(() => {
    const supabase = createClient();
    supabase
      .from('documents')
      .select('*, summary')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setDocuments(data || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">All Documents</h2>
        <div className="flex gap-2">
          <a
            href="/api/documents/report"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📄 PDF
          </a>
          <a
            href="/api/documents/report/excel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            📊 Excel
          </a>
          <button
            onClick={handleSendEmail}
            disabled={sending}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {sending ? 'Envoi...' : '📧 Email'}
          </button>
          <UploadButton onUploaded={loadDocuments} />
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading documents...</p>}
      {!loading && documents.length === 0 && (
        <p className="text-gray-500">
          No documents yet. Click &quot;+ Upload Document&quot; to add one.
        </p>
      )}

      {!loading && documents.length > 0 && (
        <Card>
          <table className="w-full">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-3">Filename</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Sender</th>
                <th className="text-left p-3">Résumé</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Received</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/dashboard/documents/${doc.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {doc.original_filename}
                    </Link>
                  </td>
                  <td className="p-3">{doc.type}</td>
                  <td className="p-3">{doc.sender_email}</td>
                  <td className="p-3 text-sm text-gray-600 max-w-md">
                    {doc.summary || (
                      <span className="text-gray-400 italic">Pas de résumé</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant={statusVariants[doc.status] || 'default'}>
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {new Date(doc.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
  <button
    onClick={() => handleDelete(doc.id, doc.original_filename)}
    className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium"
    title="Supprimer définitivement"
  >
    🗑️ Supprimer
  </button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}