/**
 * Inngest failed-job webhook receiver.
 *
 * Configure in Inngest dashboard:
 *   Webhook URL: https://toolnexus-app.vercel.app/api/webhooks/inngest-alerts
 *   Events: function.failed
 *
 * Sends a WhatsApp alert via OpenClaw when an Inngest job fails.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const OPENCLAW_WEBHOOK_SECRET = process.env.INNGEST_ALERT_WEBHOOK_SECRET ?? "";
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "";
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

interface InngestFailedEvent {
  name: string;
  data: {
    function_id: string;
    run_id: string;
    error?: {
      message?: string;
      name?: string;
    };
    event?: {
      name?: string;
      data?: Record<string, unknown>;
    };
  };
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return true; // skip verification in dev
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace("sha256=", "")),
    Buffer.from(expected)
  );
}

async function sendAlert(message: string) {
  if (!OPENCLAW_GATEWAY_URL || !OPENCLAW_GATEWAY_TOKEN) {
    console.warn("[inngest-alerts] OpenClaw gateway not configured, skipping alert");
    return;
  }
  try {
    await fetch(`${OPENCLAW_GATEWAY_URL}/api/system-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({ text: message }),
    });
  } catch (e) {
    console.error("[inngest-alerts] Failed to send alert:", e);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-inngest-signature") ?? "";

  if (OPENCLAW_WEBHOOK_SECRET && !verifySignature(body, signature, OPENCLAW_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: InngestFailedEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.name === "inngest/function.failed") {
    const { function_id, run_id, error, event: triggerEvent } = event.data;
    const message = [
      `🚨 *Inngest job failed*`,
      `Function: \`${function_id}\``,
      `Run: \`${run_id}\``,
      `Error: ${error?.message ?? "unknown"}`,
      triggerEvent?.name ? `Triggered by: \`${triggerEvent.name}\`` : null,
      `View: https://app.inngest.com/env/production/functions/${encodeURIComponent(function_id)}/runs/${run_id}`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendAlert(message);
  }

  return NextResponse.json({ ok: true });
}
