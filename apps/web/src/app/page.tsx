import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-4">Accounting AI Automation</h1>
        <p className="text-xl text-gray-600 mb-8">
          Automated document processing pipeline
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
