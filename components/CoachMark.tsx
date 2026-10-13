/** The coach's identity: a line icon for navigation and a filled avatar for chat. */
export function CoachIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3.5c-4.7 0-8.5 3.2-8.5 7.3 0 2.2 1.1 4.2 2.9 5.5L5.8 20l4-1.9c.7.2 1.4.2 2.2.2 4.7 0 8.5-3.3 8.5-7.4" />
      <path d="M8.2 13.6l1.8-5 1.8 5M8.8 12h2.4M14.3 10.9h2.6M15.6 9.6v2.6" />
      <path d="M19 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" strokeWidth={1} />
    </svg>
  );
}

export function CoachAvatar({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={`shrink-0 ${className}`} role="img" aria-label="A+ Coach">
      <defs>
        <linearGradient id="coach-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#coach-g)" />
      <text x="18.5" y="25.5" textAnchor="middle" fontFamily="var(--font-geist-sans), system-ui, sans-serif" fontWeight="700" fontSize="15" fill="#fff">A</text>
      <text x="26.5" y="20" textAnchor="middle" fontFamily="var(--font-geist-sans), system-ui, sans-serif" fontWeight="800" fontSize="11" fill="#F2C14E">+</text>
      <path d="M30 8.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" fill="#fff" opacity=".9" />
    </svg>
  );
}
