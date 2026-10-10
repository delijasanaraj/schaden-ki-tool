// Sehr einfache, best-effort In-Memory-Ratenbegrenzung pro IP. Ueberlebt keinen
// Serverless-Kaltstart und gilt nicht ueber mehrere Instanzen hinweg - siehe README.
export function createRateLimiter(limitPerHour: number) {
  const log = new Map<string, number[]>();
  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const timestamps = (log.get(ip) || []).filter((t) => t > hourAgo);
    timestamps.push(now);
    log.set(ip, timestamps);
    return timestamps.length > limitPerHour;
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
