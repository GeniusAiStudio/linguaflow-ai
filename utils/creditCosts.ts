export function calculateTextCost(textLength: number): number {
  if (textLength < 5000) return 4;
  if (textLength < 10000) return 8;
  if (textLength < 15000) return 12;
  if (textLength < 20000) return 16;
  if (textLength < 25000) return 20;
  return 24;
}

export function calculateVideoCost(durationInSeconds: number): number {
  if (durationInSeconds <= 60) return 10;
  if (durationInSeconds <= 180) return 32;
  return 50; 
}
