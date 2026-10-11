import { LicenseGuard } from "@/components/license/LicenseGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <LicenseGuard>
          <main className="flex-1">{children}</main>
        </LicenseGuard>
      </div>
    </div>
  );
}