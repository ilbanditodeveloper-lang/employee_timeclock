/**
 * Fondo del hero con la imagen proporcionada por el cliente.
 */
export function LandingHeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src="/landing-hero-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-[68%_center] lg:object-center"
        fetchPriority="high"
        decoding="async"
      />

      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/90 to-transparent" />

      <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/40 via-transparent to-transparent sm:from-[#001428]/30" />
    </div>
  );
}
