import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AuditLog } from "@/components/audit/AuditLog";

export default function AuditPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Audit Log" />
        <main className="p-8">
          <AuditLog />
        </main>
      </div>
    </div>
  );
}
