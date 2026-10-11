import { ExceptionReview } from "@/components/exceptions/ExceptionReview";

export const metadata = {
  title: "Exceptions — Accounting AI",
  description: "Documents nécessitant une vérification manuelle",
};

export default function ExceptionsPage() {
  return (
    <main className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">
          ⚠️ Documents à vérifier
        </h2>
        <p className="text-sm text-gray-500 max-w-3xl">
          Cette page liste les documents dont le score de confiance de
          l'IA est inférieur à 90%. Vérifiez les informations extraites
          manuellement, puis approuvez ou rejetez chaque document.
        </p>
      </div>

      <ExceptionReview />
    </main>
  );
}