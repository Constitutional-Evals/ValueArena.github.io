// Stepped, pixel-grid landscape used behind the home hero and the site footer.
// Shapes are computed on an art-pixel grid and drawn as merged column rects
// with crisp edges, so they scale up as hard squares like the rest of the art.

type Layer = { top: (x: number) => number; fill: string; edge?: string; dither?: boolean };

const W = 240;
const H = 80;

// Merge runs of columns with the same height into one rect each
function columns(top: (x: number) => number) {
  const runs: { x: number; w: number; y: number }[] = [];
  for (let x = 0; x < W; x++) {
    const y = Math.max(0, Math.min(H, Math.round(top(x))));
    const last = runs[runs.length - 1];
    if (last && last.y === y) last.w += 1;
    else runs.push({ x, w: 1, y });
  }
  return runs;
}

// Rising sheets, like a score curve climbing to the right
const HERO: Layer[] = [
  { top: (x) => H - 8 - 70 * Math.pow(x / W, 2.6) - 6 * Math.sin(x / 19), fill: 'var(--hill-1)', dither: true },
  { top: (x) => H - 2 - 58 * Math.pow(Math.max(0, x - 30) / (W - 30), 2.2), fill: 'var(--hill-2)', edge: 'var(--hill-edge)' },
  { top: (x) => H + 4 - 44 * Math.pow(Math.max(0, x - 70) / (W - 70), 1.8), fill: 'var(--hill-3)', edge: 'var(--hill-edge)' },
];

// Rolling hills for the footer's wordmark to sit on
const FOOTER: Layer[] = [
  { top: (x) => 30 + 9 * Math.sin(x / 23) + 6 * Math.sin(x / 9 + 1), fill: 'var(--hill-1)', dither: true },
  { top: (x) => 44 + 8 * Math.sin(x / 17 + 2) + 4 * Math.sin(x / 7), fill: 'var(--hill-2)', edge: 'var(--hill-edge)' },
  { top: (x) => 58 + 6 * Math.sin(x / 13 + 4), fill: 'var(--hill-3)', edge: 'var(--hill-edge)' },
];

export function PixelHills({ variant, className = '' }: { variant: 'hero' | 'footer'; className?: string }) {
  const layers = variant === 'hero' ? HERO : FOOTER;
  return (
    <svg
      className={`pixel-hills pixel-hills-${variant} ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {layers.map((layer, i) => {
        const runs = columns(layer.top);
        return (
          <g key={i}>
            {layer.dither &&
              // A checkerboard fringe along the top edge softens the step
              runs.flatMap((r) =>
                Array.from({ length: r.w }, (_, k) => r.x + k)
                  .filter((x) => (x + r.y) % 2 === 0)
                  .map((x) => <rect key={`d${x}`} x={x} y={r.y - 2} width={1} height={1} fill={layer.fill} />),
              )}
            {runs.map((r) => (
              <rect key={r.x} x={r.x} y={r.y} width={r.w} height={H - r.y} fill={layer.fill} />
            ))}
            {layer.edge &&
              runs.map((r) => <rect key={`e${r.x}`} x={r.x} y={r.y} width={r.w} height={1} fill={layer.edge} />)}
          </g>
        );
      })}
    </svg>
  );
}
