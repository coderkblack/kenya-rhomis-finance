import { NextRequest, NextResponse } from "next/server";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 15_000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });

  const body = await req.json();
  const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, ...body }),
      signal: controller.signal,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "groq_timeout", message: "The AI service took too long to respond. Your data was not lost. Try submitting again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "groq_unavailable", message: "The AI service could not be reached. You can still score the household by filling in values manually." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
