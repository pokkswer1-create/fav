/** Helpers for syncing scout video clock with an HTMLVideoElement. */

export function captureClockFromPlayer(player: { currentTime: number }): number {
  const t = Number(player.currentTime);
  if (!Number.isFinite(t) || t < 0) return 0;
  return Number(t.toFixed(1));
}

export function shouldAutoFollowPlayback(opts: {
  followPlayback: boolean;
  manualOverride: boolean;
}): boolean {
  return opts.followPlayback && !opts.manualOverride;
}

export function nextClockAfterSeek(current: number, deltaSec: number): number {
  const next = Number(current) + Number(deltaSec);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Number(next.toFixed(1));
}
