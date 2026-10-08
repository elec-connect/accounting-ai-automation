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

    // Extraire le texte du PDF côté client AVANT l'upload
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const { extractPdfText } = await import('@/lib/pdf-client');
        const extractedText = await extractPdfText(file);
        formData.append('pre_extracted_text', extractedText);
        console.log('PDF extracted client-side, length:', extractedText.length);
      } catch (err) {
        console.error('Client PDF extraction failed:', err);
      }
    }

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        alert('Upload failed: ' + result.error);
      } else {
        alert('Upload successful!');
        onUploaded();
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
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