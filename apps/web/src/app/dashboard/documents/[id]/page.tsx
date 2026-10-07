import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentDetail } from "@/components/documents/DocumentDetail";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title={`Document ${id.slice(0, 8)}`} />
        <main className="p-8">
          <DocumentDetail id={id} />
        </main>
      </div>
    </div>
  );
}
