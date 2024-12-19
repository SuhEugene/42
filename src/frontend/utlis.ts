export function deterministicRandomHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++)
    hash = (username.charCodeAt(i)*76) + ((hash << 5) - hash);
  return Math.abs(hash % 360);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}