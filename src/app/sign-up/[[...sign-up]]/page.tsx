import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <SignUp />
    </main>
  );
}
