import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IHanger = (p: P) => (
  <Svg {...p}>
    <path d="M12 6.6a2.1 2.1 0 1 0-2.1-2.1" />
    <path d="M12 6.6v1.9" />
    <path d="M12 8.5 3.6 14.9a1.3 1.3 0 0 0 .8 2.3h15.2a1.3 1.3 0 0 0 .8-2.3L12 8.5Z" />
  </Svg>
);

export const IGrid = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
  </Svg>
);

export const IPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ICalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 10h17M8 2.8V7M16 2.8V7" />
  </Svg>
);

export const IChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V9M10 20V4M16 20v-8M21 20H3" />
  </Svg>
);

export const IHeart = (p: P & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return (
    <Svg {...rest} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 0-6.4 4.3 4.3 0 0 1 6.2 0l.9 1 .9-1a4.3 4.3 0 0 1 6.2 0 4.6 4.6 0 0 1 0 6.4L12 20.3Z" />
    </Svg>
  );
};

export const IBookmark = (p: P & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return (
    <Svg {...rest} fill={filled ? "currentColor" : "none"}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
};

export const IChevronL = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5.5-6 6.5 6 6.5" />
  </Svg>
);

export const IChevronR = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5.5 6 6.5-6 6.5" />
  </Svg>
);

export const ILock = (p: P & { open?: boolean }) => {
  const { open, ...rest } = p;
  return (
    <Svg {...rest}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      {open ? <path d="M8.5 10.5V7.6A3.5 3.5 0 0 1 15 6" /> : <path d="M8.5 10.5V7.6a3.5 3.5 0 0 1 7 0v2.9" />}
      <circle cx="12" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
};

export const IShuffle = (p: P) => (
  <Svg {...p}>
    <path d="M16.5 4.5H20v3.5M20 4.5l-6.2 6.2M4 7h3.4c.9 0 1.7.4 2.3 1l.6.7M16.5 19.5H20V16M20 19.5l-6.2-6.2M4 17h3.4c.9 0 1.7-.4 2.3-1l.6-.7" />
  </Svg>
);

export const ICheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const IX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ISearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);

export const ISun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
  </Svg>
);

export const ICloud = (p: P) => (
  <Svg {...p}>
    <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.6 7.5H7Z" />
  </Svg>
);

export const IRain = (p: P) => (
  <Svg {...p}>
    <path d="M7 15.5a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.6 7.5" />
    <path d="M8 18.5v2M12 17.5v2.6M16 18.5v2" />
  </Svg>
);

export const ISnow = (p: P) => (
  <Svg {...p}>
    <path d="M7 15.5a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.6 7.5" />
    <path d="M8 18.5v.01M12 20v.01M16 18.5v.01M10 20.5v.01M14 17.5v.01" />
  </Svg>
);

export const IStorm = (p: P) => (
  <Svg {...p}>
    <path d="M7 15.5a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.6 7.5" />
    <path d="m12.5 14.5-2.5 4h3l-2 4" />
  </Svg>
);

export const IFog = (p: P) => (
  <Svg {...p}>
    <path d="M7 13.5a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6 1.4 3.8 3.8 0 0 1-.6 7.5" />
    <path d="M5 17h14M7 20h10" />
  </Svg>
);

export const ISparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
    <path d="M19 15.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" />
  </Svg>
);

export const ITrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6M6.5 6.5l.8 12.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.6M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const IPencil = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5 19 9.5 8.5 20H4v-4.5L14.5 5ZM12.5 7l4.5 4.5" />
  </Svg>
);

export const ICamera = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7.5h2.6l1.5-2h6.8l1.5 2h2.6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.6" />
  </Svg>
);

export const ISuitcase = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="7.5" width="16" height="13" rx="2.5" />
    <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M8.5 11v6M15.5 11v6" />
  </Svg>
);

export const IDrop = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5s6 6.2 6 10.5a6 6 0 1 1-12 0C6 9.7 12 3.5 12 3.5Z" />
  </Svg>
);

export const ISliders = (p: P) => (
  <Svg {...p}>
    <path d="M5 8h6M15 8h4M5 16h4M13 16h6" />
    <circle cx="13" cy="8" r="2" />
    <circle cx="11" cy="16" r="2" />
  </Svg>
);

export const IArrowR = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15M14 6.5 19.5 12 14 17.5" />
  </Svg>
);

export const IUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4M7.5 8 12 3.5 16.5 8" />
    <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const ITag = (p: P) => (
  <Svg {...p}>
    <path d="m12.6 3.5 7.9 7.9a1.4 1.4 0 0 1 0 2L14 20a1.4 1.4 0 0 1-2 0l-7.9-7.9a1.3 1.3 0 0 1-.4-.9V4.5a1 1 0 0 1 1-1h6.9c.4 0 .7.1 1 .4Z" />
    <circle cx="8.3" cy="8.3" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.01" />
  </Svg>
);
