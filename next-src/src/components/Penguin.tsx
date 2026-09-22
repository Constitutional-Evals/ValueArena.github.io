// A hand-drawn pixel sprite shared by loading, empty, and error states.
interface Props {
  size?: number;
  state?: 'idle' | 'loading' | 'error';
  className?: string;
}

const sprite = [
  '................',
  '......####......',
  '.....######.....',
  '....########....',
  '....##wwww##....',
  '....#wwwwww#....',
  '....#wwwwww#....',
  '....##wyyw##....',
  '...###wwww###...',
  '..###wwwwww###..',
  '..###wwwwww###..',
  '...##wwwwww##...',
  '....#wwwwww#....',
  '....##wwww##....',
  '.....######.....',
  '....yyy..yyy....',
];
const palette: Record<string, string> = { '#': '#344b49', w: '#fff2d8', y: '#d99a46' };

export function Penguin({ size = 56, state = 'idle', className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      shapeRendering="crispEdges" role="img"
      aria-label={state === 'error' ? 'Error penguin' : state === 'loading' ? 'Loading penguin' : 'Penguin'}
      className={`penguin-pixel ${state === 'loading' ? 'penguin-wobble' : ''} ${className}`}>
      <g transform="translate(2 2)">
        {sprite.flatMap((row, y) => [...row].map((pixel, x) => palette[pixel]
          ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[pixel]} />
          : null))}
        <g className={state === 'loading' ? 'penguin-blink' : ''} fill="#253634">
          <rect x="6" y="5" width="1" height="2" />
          <rect x="9" y="5" width="1" height="2" />
        </g>
        {state === 'error' && <rect x="9" y="7" width="1" height="2" fill="#6aa7b1" />}
      </g>
    </svg>
  );
}
