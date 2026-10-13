import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-mute">That link doesn't exist or is no longer shared.</p>
      <Link className="btn-primary mt-5" href="/">Go to Today</Link>
    </div>
  );
}
