"use client";

import { ProjectStatus } from "./types";

const STAGES = [
  { label: "Downloading video" },
  { label: "Extracting audio" },
  { label: "Transcribing" },
  { label: "Generating highlights" },
  { label: "Finalizing" },
] as const;

function getActiveStep(status: ProjectStatus): number {
  if (status === "processing") return 0;
  if (status === "extracting_audio") return 1;
  if (status === "transcribing") return 2;
  if (status === "generating_highlights") return 3;
  if (status === "completed") return 4;
  return -1;
}

interface ProcessingStepperProps {
  status: ProjectStatus;
}

function ProcessingStepper({ status }: ProcessingStepperProps) {
  const activeStep = getActiveStep(status);
  return (
    <div
      data-testid="processing-stepper"
      className="bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
        Processing stages
      </h2>
      <ol className="flex flex-col gap-3">
        {STAGES.map((stage, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          return (
            <li key={stage.label} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-800 text-gray-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-sm ${
                  isDone
                    ? "text-green-400"
                    : isActive
                      ? "text-yellow-400 font-medium"
                      : "text-gray-500"
                }`}
              >
                {stage.label}
              </span>
              {isActive && (
                <svg
                  className="w-4 h-4 text-yellow-400 animate-spin ml-auto"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                  <path
                    strokeLinecap="round"
                    d="M4 12a8 8 0 018-8"
                    strokeWidth="4"
                    className="opacity-75"
                  />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface FailedStateProps {
  errorMessage: string | null;
  onRetry: () => void;
}

function FailedState({ errorMessage, onRetry }: FailedStateProps) {
  return (
    <div className="bg-red-950 border border-red-800 rounded-xl p-5 flex flex-col gap-3">
      <h2 className="text-red-400 font-semibold">Processing failed</h2>
      {errorMessage && <p className="text-red-300 text-sm">{errorMessage}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="self-start rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors min-h-[44px]"
      >
        Retry
      </button>
    </div>
  );
}

export interface ProcessingStatusProps {
  status: ProjectStatus;
  errorMessage: string | null;
  onRetry: () => void;
}

export function ProcessingStatus({ status, errorMessage, onRetry }: ProcessingStatusProps) {
  const isProcessing = !["completed", "failed"].includes(status) && status !== "pending";

  return (
    <>
      {isProcessing && <ProcessingStepper status={status} />}
      {status === "failed" && <FailedState errorMessage={errorMessage} onRetry={onRetry} />}
      {status === "pending" && (
        <div className="text-gray-400 text-sm">
          Project is queued and will begin processing shortly.
        </div>
      )}
    </>
  );
}
