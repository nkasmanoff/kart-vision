import { NextRequest, NextResponse } from "next/server";

const MODAL_SCENE_URL =
  "https://nkasmanoff--mario-kart-detector-racedetector-predict.modal.run";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { image } = body as { image: string };

  if (!image) {
    return NextResponse.json(
      { error: "Missing 'image' field (base64-encoded)" },
      { status: 400 }
    );
  }

  const resp = await fetch(MODAL_SCENE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });

  const data = await resp.text();

  return new NextResponse(data, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
