/**
 * Copies text, returning whether it worked. The async Clipboard API only exists on secure origins (not on
 * plain http from a LAN address or tunnel) and can be blocked in iframes, so fall back to a selected textarea.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* missing or blocked: try the legacy path */
  }
  const active = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length); // iOS Safari ignores select() on its own
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    /* unsupported */
  }
  area.remove();
  active?.focus();
  return ok;
}
