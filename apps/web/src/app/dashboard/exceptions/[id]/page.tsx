'use client';

import { useParams } from 'next/navigation';

export default function ExceptionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Exception Details</h1>
      <p className="mt-2 text-gray-600">Exception ID: {id}</p>
    </div>
  );
}
