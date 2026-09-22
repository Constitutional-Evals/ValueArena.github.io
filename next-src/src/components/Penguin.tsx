// Generated pixel-art mascot, shared by loading, empty, and error states.
interface Props {
  size?: number;
  state?: 'idle' | 'loading' | 'error';
  className?: string;
}

export function Penguin({ size = 56, state = 'idle', className = '' }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/assets/art/penguin-generated.webp" width={size} height={size}
      alt={state === 'error' ? 'Error penguin' : state === 'loading' ? 'Loading penguin' : 'Penguin'}
      className={`penguin-pixel ${state === 'loading' ? 'penguin-wobble' : ''} ${className}`} />
  );
}
