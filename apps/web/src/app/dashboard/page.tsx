import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardStats } from "@/components/dashboard/StatsDashboard";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        <Header title="Dashboard" />
        <main className="p-6 lg:p-8">
          <DashboardStats />
        </main>
      </div>
    </div>
  );
}