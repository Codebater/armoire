import { NextResponse } from "next/server";

export const maxDuration = 30;

const MODEL_DEFAULT = "claude-haiku-4-5";

const PROMPT = `You are a fashion archivist. Look at this single garment/footwear/bag photo and return ONLY a JSON object (no prose, no markdown fences) with these fields:

{
  "kind": one of ["top","bottom","dress","outer","shoes","bag","accessory"],
  "name": short elegant product-style name, e.g. "Silk Blouse", max 4 words,
  "brand": visible brand name or null,
  "colors": 1-2 of ["black","white","cream","grey","beige","camel","brown","navy","denim","olive","sage","green","blue","red","burgundy","pink","purple","yellow","orange","gold","silver"],
  "styles": 1-3 of ["minimal","classic","elegant","romantic","edgy","sporty","street","boho","preppy"],
  "seasons": subset of ["spring","summer","autumn","winter"] the piece suits,
  "occasions": 1-4 of ["casual","work","dinner","party","formal","travel","sport"],
  "warmth": integer 0-3 (0 airy summer piece, 3 heavy winter piece),
  "formality": integer 0-4 (0 loungewear, 4 black tie)
}`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "no-key" }, { status: 501 });
  }
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image?.startsWith("data:image/")) {
      return NextResponse.json({ error: "bad-image" }, { status: 400 });
    }
    const [head, data] = image.split(",", 2);
    const mediaType = head.slice(5, head.indexOf(";"));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || MODEL_DEFAULT,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text();
      console.error("[categorize] anthropic error", res.status, body.slice(0, 300));
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    const payload = await res.json();
    const text: string = payload?.content?.[0]?.text ?? "";
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonStr.slice(jsonStr.indexOf("{"), jsonStr.lastIndexOf("}") + 1));
    const attrs = {
      kind: parsed.kind,
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 48) : undefined,
      brand: typeof parsed.brand === "string" ? parsed.brand.slice(0, 32) : undefined,
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 2) : undefined,
      styles: Array.isArray(parsed.styles) ? parsed.styles.slice(0, 3) : undefined,
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons : undefined,
      occasions: Array.isArray(parsed.occasions) ? parsed.occasions : undefined,
      warmth: typeof parsed.warmth === "number" ? parsed.warmth : undefined,
      formality: typeof parsed.formality === "number" ? parsed.formality : undefined,
    };
    return NextResponse.json({ attrs });
  } catch (e) {
    console.error("[categorize]", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
