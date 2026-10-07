import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white border rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Create your account</h1>
        <p className="text-sm text-gray-600 mb-6">
          Start automating your documents
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
