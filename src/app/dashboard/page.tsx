"use client";

import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-xl font-bold">ClipCrafter</span>
        <UserButton />
      </header>

      <main className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <p className="text-gray-400 mb-6">
          No projects yet. Upload a video to get started.
        </p>
        <button
          type="button"
          className="rounded-lg bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 transition-colors"
        >
          Upload a Video
        </button>
      </main>
    </div>
  );
}
