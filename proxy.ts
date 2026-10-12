import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request on Vercel.
 *  1. Optional IP allowlist  — set ALLOWED_IPS="1.2.3.4, 5.6.7.0/24, 2401:db8::1" in Vercel env.
 *     Leave it unset to disable. Vercel sets x-real-ip / x-forwarded-for itself, so clients can't spoof it.
 *  2. Strict Content-Security-Policy with a fresh nonce per request (no unsafe-inline scripts).
 */

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const part of p) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function ipAllowed(ip: string, rules: string[]): boolean {
  const clean = ip.replace(/^::ffff:/, "").trim().toLowerCase();
  for (const raw of rules) {
    const rule = raw.trim().toLowerCase();
    if (!rule) continue;
    if (rule.includes("/")) {
      const [base, bitsStr] = rule.split("/");
      const bits = Number(bitsStr);
      const a = ipv4ToInt(clean);
      const b = ipv4ToInt(base);
      if (a == null || b == null || !(bits >= 0 && bits <= 32)) continue;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      if (((a & mask) >>> 0) === ((b & mask) >>> 0)) return true;
    } else if (rule === clean) {
      return true;
    }
  }
  return false;
}

export function proxy(request: NextRequest) {
  const allow = (process.env.ALLOWED_IPS ?? "").split(",").filter((s) => s.trim());
  if (allow.length) {
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
    if (!ip || !ipAllowed(ip, allow)) {
      return new NextResponse(`Access denied for ${ip || "unknown IP"}.`, {
        status: 403,
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      });
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https/, "wss")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // everything except static assets
    { source: "/((?!_next/static|_next/image|favicon.ico|icon|apple-touch-icon.png|og.png|logo.svg|manifest.webmanifest|sw.js|api/health).*)" },
  ],
};
