/** A short vibration where the device supports it (Android browsers); a no-op everywhere else. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* blocked (no user gesture yet, or a permissions policy): feedback is optional */
  }
}
