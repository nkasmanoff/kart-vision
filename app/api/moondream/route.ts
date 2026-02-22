import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.moondream.ai/v1";
const TUNING_BASE = "https://api.moondream.ai/v1/tuning";

export async function POST(req: NextRequest) {
  const apiKey = process.env.MOONDREAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MOONDREAM_API_KEY not configured on server" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { mode, ...payload } = body as {
    mode: "query" | "rollouts";
    [key: string]: unknown;
  };

  const url =
    mode === "rollouts" ? `${TUNING_BASE}/rollouts` : `${API_BASE}/query`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Moondream-Auth": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.text();

  return new NextResponse(data, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
