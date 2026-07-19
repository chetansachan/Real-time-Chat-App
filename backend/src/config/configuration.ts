const toInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtlSeconds: toInt(process.env.JWT_ACCESS_TTL, 900),
  },
  refreshTtlSeconds: toInt(process.env.REFRESH_TTL, 2_592_000),
  cookie: {
    name: 'refresh_token',
    path: '/api/auth',
    secure:
      process.env.COOKIE_SECURE === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
  },
  chat: {
    maxRoomsPerSocket: 200,
  },
});
