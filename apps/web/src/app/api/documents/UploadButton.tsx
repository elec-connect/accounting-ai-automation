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
    <div>
      <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {uploading ? 'Uploading...' : '+ Upload Document'}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      </label>
    </div>
  );
}