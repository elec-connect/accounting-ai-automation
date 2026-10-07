import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ExceptionList } from "@/components/exceptions/ExceptionList";

export default function ExceptionsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Exception Queue" />
        <main className="p-8">
          <ExceptionList />
        </main>
      </div>
    </div>
  );
}
