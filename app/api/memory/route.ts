import { NextResponse } from "next/server";
import { readIdentityMd, readSoulMd, writeIdentityMd, writeSoulMd } from "@/lib/fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const identity = readIdentityMd();
    const soul = readSoulMd();
    
    return NextResponse.json({
      ok: true,
      data: {
        identity,
        soul
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, content } = body;

    if (!type || typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "Missing type or content string" }, { status: 400 });
    }

    if (type === "identity") {
      writeIdentityMd(content);
    } else if (type === "soul") {
      writeSoulMd(content);
    } else {
      return NextResponse.json({ ok: false, error: "Invalid memory type. Must be 'identity' or 'soul'" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
