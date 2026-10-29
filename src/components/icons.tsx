// Brand icons from the landing (personal-crm-landing, design/landing/assets)

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient
          id="logo-gradient"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: "var(--thread-olive)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--thread-peach)" }} />
          <stop offset="1" style={{ stopColor: "var(--thread-lavender)" }} />
        </linearGradient>
      </defs>
      <path
        d="M3 26 C 10 26, 12 9, 20 9 C 28 9, 28 22, 20 22 C 12 22, 13 33, 22 33 C 29 33, 31 26, 37 24"
        stroke="url(#logo-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The two-thread magnifier of the landing's "Быстрый поиск", with thicker
// strokes so it stays readable at input-icon size
export function ThreadSearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 56" fill="none" aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="14"
        className="stroke-thread-olive"
        strokeWidth="5"
      />
      <path
        d="M34 34 L48 48"
        className="stroke-thread-peach"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
