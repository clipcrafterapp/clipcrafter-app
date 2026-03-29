import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

const RAILWAY_WORKER_URL =
  process.env.RAILWAY_WORKER_URL || "https://clipcrafter-app-production-9647.up.railway.app";

interface HealthCheck {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

async function checkSupabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.from("projects").select("id").limit(1);
    if (error) throw error;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (e: unknown) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkR2(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await s3.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME! }));
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (e: unknown) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkRailwayWorker(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const res = await fetch(`${RAILWAY_WORKER_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (e: unknown) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const [supabase, r2, worker] = await Promise.all([
    checkSupabase(),
    checkR2(),
    checkRailwayWorker(),
  ]);

  const checks = { supabase, r2, worker };
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyDown = Object.values(checks).some((c) => c.status === "down");

  const overall: "ok" | "degraded" | "down" = allOk ? "ok" : anyDown ? "down" : "degraded";

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      checks,
    },
    { status: overall === "ok" ? 200 : 503 }
  );
}
