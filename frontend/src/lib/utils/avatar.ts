const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-teal-400 to-emerald-600',
  'bg-gradient-to-br from-sky-400 to-indigo-600',
  'bg-gradient-to-br from-rose-400 to-pink-600',
  'bg-gradient-to-br from-amber-400 to-orange-600',
  'bg-gradient-to-br from-violet-400 to-purple-600',
  'bg-gradient-to-br from-cyan-400 to-blue-600',
  'bg-gradient-to-br from-lime-400 to-green-600',
  'bg-gradient-to-br from-fuchsia-400 to-rose-600',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarGradient(seed: string): string {
  const index = hashString(seed) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index] ?? AVATAR_GRADIENTS[0];
}

export function initials(name: string): string {
  const parts = name
    .replace(/^[#@]/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
