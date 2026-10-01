import type { ReactNode, SVGProps } from "react";

/**
 * One stroke icon set on a 24px grid, so every glyph has the same weight on every platform (emoji and
 * Unicode symbols render differently on each phone).
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(paths: ReactNode, fill = false) {
  return function Icon({ size = 20, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={fill ? "currentColor" : "none"}
        stroke={fill ? "none" : "currentColor"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable={false}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const IconBack = icon(<path d="M15 5l-7 7 7 7" />);
export const IconClose = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const IconCheck = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconChevronDown = icon(<path d="M6 9l6 6 6-6" />);
export const IconChevronRight = icon(<path d="M9 6l6 6-6 6" />);
export const IconArrowRight = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconFlag = icon(<path d="M5 21V4m0 0h11l-2 4 2 4H5" />);
export const IconPlay = icon(<path d="M7 4.5v15l13-7.5z" />, true);
export const IconPause = icon(<path d="M6 4h4v16H6zM14 4h4v16h-4z" />, true);
export const IconReplay = icon(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </>,
);
export const IconShare = icon(
  <>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </>,
);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </>,
);
export const IconBag = icon(
  <>
    <path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </>,
);
export const IconCalendar = icon(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);
export const IconGrid = icon(
  <>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M3.5 15h17M9.5 4v16" />
  </>,
);
export const IconTruck = icon(
  <>
    <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </>,
);
export const IconTrash = icon(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
export const IconDedupe = icon(
  <>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </>,
);
export const IconUndo = icon(<path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />);
export const IconReset = icon(
  <>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v5h-5" />
  </>,
);
export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const IconBolt = icon(<path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12z" />, true);
export const IconTrophy = icon(
  <>
    <path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 21h8M10 17h4" />
    <path d="M16 6h3v1.5A3.5 3.5 0 0 1 15.8 11M8 6H5v1.5A3.5 3.5 0 0 0 8.2 11" />
  </>,
);
export const IconLink = icon(
  <>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </>,
);
export const IconLock = icon(
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </>,
);
export const IconAlert = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </>,
);
export const IconSortUp = icon(<path d="M7 14l5-5 5 5" />);
export const IconSortDown = icon(<path d="M7 10l5 5 5-5" />);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconMusic = icon(<path d="M9 18V5.5l11-2V16M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />);

export const STAGE_ICONS = { shopping: IconBag, calendar: IconCalendar, sheet: IconGrid } as const;
