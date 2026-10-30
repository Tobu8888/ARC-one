/**
 * ArconeModalIcon — small icon-only usage (e.g. modal headers).
 * Rendered from the same /logo.png source as ArconeLockup.
 */
export function ArconeModalIcon({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      style={{
        display: 'block',
        height: size,
        width: size,
        objectFit: 'contain',
        borderRadius: Math.round(size * 0.22),
        flexShrink: 0,
      }}
      draggable={false}
    />
  )
}

/**
 * ArconeLockup — single source of truth for the ARCone logo lockup.
 * Renders: [icon logo.png LEFT] [wordmark arc_one.png RIGHT]
 * All sizes derived from prop h (height in px).
 */
export default function ArconeLockup({ h }: { h: number }) {
  const gap = Math.round(h * 0.26)
  const wordmarkWidth = Math.round(h * 4.339)
  return (
    <a
      href="/"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: h,
        gap,
        lineHeight: 0,
        flex: '0 0 auto',
        textDecoration: 'none',
      }}
    >
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        style={{
          display: 'block',
          height: h,
          width: h,
          objectFit: 'contain',
          flexShrink: 0,
          margin: 0,
          padding: 0,
          maxWidth: 'none',
        }}
        draggable={false}
      />
      <img
        src="/arc_one.png"
        alt="ARCone"
        style={{
          display: 'block',
          height: h,
          width: wordmarkWidth,
          objectFit: 'contain',
          flexShrink: 0,
          margin: 0,
          padding: 0,
          maxWidth: 'none',
        }}
        draggable={false}
      />
    </a>
  )
}
