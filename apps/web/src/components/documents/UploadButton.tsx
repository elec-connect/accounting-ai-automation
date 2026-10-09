'use client';

import { useState } from 'react';

export function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploading(true);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();

    if (!res.ok) {
      // Gestion spécifique du doublon
      if (res.status === 409 && result.duplicate) {
        alert(
          `⚠️ Ce document existe déjà !\n\n` +
          `Fichier : ${result.existingDocument?.filename || file.name}\n` +
          `Uploadé le : ${
            result.existingDocument?.uploadedAt
              ? new Date(result.existingDocument.uploadedAt).toLocaleString('fr-FR')
              : 'date inconnue'
          }`
        );
      } else {
        alert('❌ Erreur : ' + result.error);
      }
    } else {
      alert('✅ Document uploadé avec succès !');
      onUploaded();
    }
  } catch (err) {
    alert('Erreur : ' + (err instanceof Error ? err.message : 'Inconnue'));
  } finally {
    setUploading(false);
    e.target.value = '';
  }
}

  return (
    <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
      {uploading ? 'Uploading...' : '+ Upload Document'}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />
    </label>
  );
}