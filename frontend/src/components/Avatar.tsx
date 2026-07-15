'use client';

const AVATAR_COLORS = [
  '#3a76f0', '#7c4dff', '#f0503a', '#3af07c', '#f0c83a',
  '#3af0e8', '#f03ab4', '#8af03a',
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AvatarProps {
  url?: string | null;
  name: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Avatar({ url, name, size = 40, showOnline, isOnline }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fullUrl = url ? (url.startsWith('http') ? url : `${API}${url}`) : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {fullUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fullUrl}
          alt={name}
          width={size}
          height={size}
          className="avatar"
          style={{ width: size, height: size }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="avatar-placeholder"
          style={{
            width: size,
            height: size,
            background: getColor(name),
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </div>
      )}
      {showOnline && (
        <span
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: size * 0.27,
            height: size * 0.27,
            borderRadius: '50%',
            background: isOnline ? 'var(--signal-online)' : 'var(--signal-muted)',
            border: '2px solid var(--signal-sidebar)',
          }}
        />
      )}
    </div>
  );
}
