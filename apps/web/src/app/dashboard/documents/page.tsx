import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentList } from "@/components/documents/DocumentList";

export default function DocumentsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Documents" />
        <main className="p-8">
          <DocumentList />
        </main>
      </div>
    </div>
  );
}
