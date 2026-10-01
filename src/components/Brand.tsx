/** The logo: the agent's cursor mid-click. The burst takes the accent; the pointer takes the text color. */
export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg className="mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable={false}>
      <path d="M9 8l5.1 13.9 1.8-5.6 5.6-1.7z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="mark-burst" d="M8.5 1.8v2.6M1.8 8.5h2.6M3.4 3.4l1.9 1.9" fill="none" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Mark />
      <span className="brand-word">Beat the Agent</span>
    </span>
  );
}
