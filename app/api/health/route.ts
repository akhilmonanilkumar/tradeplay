// Liveness probe for Docker / load balancers. Reveals nothing about the app or its data.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
