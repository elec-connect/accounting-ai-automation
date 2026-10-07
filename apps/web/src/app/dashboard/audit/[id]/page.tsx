'use client';

import { useParams } from 'next/navigation';

export default function AuditDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Audit Details</h1>
      <p className="mt-2 text-gray-600">Audit ID: {id}</p>
    </div>
  );
}
