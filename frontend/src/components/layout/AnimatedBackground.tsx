export default function AnimatedBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    >
      {/* Primary orb - large, top center, slow drift */}
      <div className="animated-orb animated-orb--1" />

      {/* Secondary orb - mid right, opposite drift */}
      <div className="animated-orb animated-orb--2" />

      {/* Tertiary orb - bottom left, diagonal float */}
      <div className="animated-orb animated-orb--3" />

      {/* Accent orb - small, subtle, faster drift */}
      <div className="animated-orb animated-orb--4" />

      {/* Noise/grain overlay for texture */}
      <div className="animated-bg-grain" />
    </div>
  );
}
