import { useAuth } from '../contexts/AuthContext';

const style = document.createElement('style');
style.textContent = `
  @keyframes watermarkFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

export default function Watermark() {
  const { user } = useAuth();

  if (!user?.email) return null;

  const lines = Array.from({ length: 30 }, (_, i) => (
    <div key={i} className="watermark-line" style={{ whiteSpace: 'nowrap', marginBottom: '60px', fontSize: '14px', letterSpacing: '2px', fontWeight: 500 }}>
      {Array.from({ length: 6 }, (_, j) => (
        <span key={j} style={{ marginRight: '120px' }}>
          WATERMARKED FOR {user.email.toUpperCase()} &bull; {user.id.slice(0, 8)}
        </span>
      ))}
    </div>
  ));

  return (
    <div
      className="watermark-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        transform: 'rotate(-25deg)',
        opacity: 0.045,
        color: '#000',
        fontFamily: '"Inter", system-ui, sans-serif',
        animation: 'watermarkFade 1.5s ease-in-out',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {lines}
    </div>
  );
}
