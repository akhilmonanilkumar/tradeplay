import { json, rateLimited, userClient } from "@/lib/ai/auth";
import { transcribe } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/aac"];

/** Speech-to-text for browsers without the Web Speech API. Audio is forwarded once and never stored. */
export async function POST(req: Request) {
  const auth = await userClient(req);
  if (auth instanceof Response) return auth;
  if (rateLimited(`stt:${auth.user.id}`, 12)) return json({ error: "Too many requests" }, 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) return json({ error: "No audio" }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: "Recording too long (max ~2 min)" }, 413);
  const type = file.type.split(";")[0];
  if (!TYPES.includes(type)) return json({ error: `Unsupported audio type ${type}` }, 415);
  try {
    const text = await transcribe(file, `speech.${type.split("/")[1]}`);
    if (text == null) return json({ error: "No speech-to-text provider configured" }, 503);
    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
