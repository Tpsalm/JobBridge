import { ReactNode } from 'react';

interface FloatingDecorationsProps {
  className?: string;
  children?: ReactNode;
}

const shapes = [
  { top: '12%', left: '10%', size: 120, color: 'rgba(59,130,246,0.18)', blur: 34, duration: 10, delay: 0 },
  { top: '20%', left: '75%', size: 88, color: 'rgba(56,189,248,0.2)', blur: 20, duration: 14, delay: 1 },
  { top: '62%', left: '8%', size: 140, color: 'rgba(14,165,233,0.16)', blur: 44, duration: 18, delay: 2 },
  { top: '55%', left: '76%', size: 100, color: 'rgba(37,99,235,0.22)', blur: 28, duration: 12, delay: 0.6 },
  { top: '38%', left: '44%', size: 52, color: 'rgba(96,165,250,0.28)', blur: 12, duration: 20, delay: 1.7 },
];

export default function FloatingDecorations({ className = '', children }: FloatingDecorationsProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {shapes.map((shape, index) => (
        <span
          key={index}
          className="floating-shape rounded-full"
          style={{
            top: shape.top,
            left: shape.left,
            width: shape.size,
            height: shape.size,
            background: shape.color,
            filter: `blur(${shape.blur}px)`,
            animationDuration: `${shape.duration}s`,
            animationDelay: `${shape.delay}s`,
          }}
        />
      ))}
      {children}
    </div>
  );
}
