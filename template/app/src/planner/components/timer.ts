interface TimedStep {
  actualMinutes: number;
  timerStartedAt: Date | null;
}

/** Tracked time of a step in seconds, including a running timer. */
export function getTrackedSeconds(step: TimedStep, now: number): number {
  const runningSeconds = step.timerStartedAt
    ? Math.max(0, (now - new Date(step.timerStartedAt).getTime()) / 1000)
    : 0;
  return Math.floor(step.actualMinutes * 60 + runningSeconds);
}

/** Tracked time of several steps in whole minutes, including running timers. */
export function getTrackedMinutes(steps: TimedStep[], now: number): number {
  const seconds = steps.reduce(
    (total, step) => total + getTrackedSeconds(step, now),
    0,
  );
  return Math.floor(seconds / 60);
}

/** 3909 -> "1:05:09", 309 -> "05:09" */
export function formatElapsedSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mmss = `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
