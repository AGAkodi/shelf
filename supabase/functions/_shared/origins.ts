export function allowedOrigins(local: boolean, value: string): string[] {
  return [
    ...(local ? ["http://127.0.0.1:5173", "http://localhost:5173"] : []),
    ...value.split(",").filter(Boolean),
  ].filter((value) => {
    try {
      const u = new URL(value);
      const privateIpv4 = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)
        && /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)
        && u.hostname.split('.').every(part => Number(part) <= 255);
      return u.origin === value && (u.protocol === "https:" ||
        (local && u.protocol === "http:" &&
          (u.hostname === "localhost" || u.hostname === "127.0.0.1" || privateIpv4)));
    } catch {
      return false;
    }
  });
}
