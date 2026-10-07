import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsDashboard } from "@/components/dashboard/StatsDashboard";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Dashboard" />
        <main className="p-8">
          <StatsDashboard />
        </main>
      </div>
    </div>
  );
}