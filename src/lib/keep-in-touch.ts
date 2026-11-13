export const KEEP_IN_TOUCH_INTERVALS = [7, 30, 90, 365] as const;
export type KeepInTouchInterval = (typeof KEEP_IN_TOUCH_INTERVALS)[number];

export function isKeepInTouchInterval(value: number): value is KeepInTouchInterval {
  return KEEP_IN_TOUCH_INTERVALS.some((interval) => interval === value);
}

export function nextContactDate(now: Date, intervalDays: number): Date {
  if (!isKeepInTouchInterval(intervalDays)) {
    throw new Error("Invalid keep-in-touch interval");
  }
  return new Date(now.getTime() + intervalDays * 86_400_000);
}

export function isContactOverdue(nextContactAt: Date, now: Date): boolean {
  return nextContactAt.getTime() < now.getTime();
}
