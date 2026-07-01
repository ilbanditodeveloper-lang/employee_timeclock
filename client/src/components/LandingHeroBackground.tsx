/**
 * Fondo abstracto del hero (ondas + rejilla de puntos), sin imagen externa.
 */
export function LandingHeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#0b1d42]" />

      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            "linear-gradient(118deg, #0b1d42 0%, #0f2d6e 38%, #1a4fd6 72%, #2563eb 100%)",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e4bb8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="wave-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="wave-c" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.1" />
          </linearGradient>
          <pattern
            id="dot-grid"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1.5" cy="1.5" r="1.2" fill="#93c5fd" fillOpacity="0.35" />
          </pattern>
          <mask id="dots-mask">
            <ellipse cx="1080" cy="220" rx="420" ry="280" fill="white" />
          </mask>
        </defs>

        <path
          d="M520 0 C 900 80, 1100 200, 1440 120 L 1440 900 L 680 900 C 920 720, 760 380, 520 0 Z"
          fill="url(#wave-a)"
        />
        <path
          d="M640 0 C 980 140, 1200 320, 1440 280 L 1440 900 L 820 900 C 1040 680, 880 320, 640 0 Z"
          fill="url(#wave-b)"
        />
        <path
          d="M780 40 C 1040 180, 1280 360, 1440 420 L 1440 900 L 960 900 C 1120 720, 980 280, 780 40 Z"
          fill="url(#wave-c)"
        />

        <rect
          width="1440"
          height="900"
          fill="url(#dot-grid)"
          mask="url(#dots-mask)"
        />
      </svg>

      <div className="absolute -right-16 top-1/4 h-[28rem] w-[28rem] rounded-full bg-sky-400/25 blur-[100px]" />
      <div className="absolute right-[18%] top-[42%] h-56 w-56 -translate-y-1/2 rounded-full bg-blue-300/20 blur-[72px]" />

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}
