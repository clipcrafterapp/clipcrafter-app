"use client";

import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
        <span className="text-lg sm:text-xl font-bold">ClipCrafter</span>
        <UserButton />
      </header>

      <main className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-6 text-sm sm:text-base">
            No projects yet. Upload a video to get started.
          </p>
          <button
            type="button"
            className="w-full sm:w-auto rounded-lg bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 transition-colors"
          >
            Upload a Video
          </button>
        </div>
      </main>
    </div>
  );
}
