import React from "react";

/**
 * Unified, modern, line-style icon set for sidebar navigation.
 * 24x24 viewBox, 1.6 stroke, rounded line caps for a consistent look.
 */

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

const baseProps = (props: IconProps) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  stroke: "currentColor",
  ...props,
});

export const NavDashboardIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3" y="3" width="7" height="9" rx="1.6" />
    <rect x="14" y="3" width="7" height="5" rx="1.6" />
    <rect x="14" y="12" width="7" height="9" rx="1.6" />
    <rect x="3" y="16" width="7" height="5" rx="1.6" />
  </svg>
);

export const NavMenuIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
    <circle cx="19" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const NavUsersIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" />
    <circle cx="17" cy="7" r="2.4" />
    <path d="M16 14c2.8 0 5 2 5 4.5" />
  </svg>
);

export const NavInventoryIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
    <path d="M4 7l8 4 8-4" />
    <path d="M12 11v10" />
  </svg>
);

export const NavGameIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M7 8h10a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4h-2l-2-2h-2l-2 2H7a4 4 0 0 1-4-4v0a4 4 0 0 1 4-4Z" />
    <path d="M8 12h2M9 11v2" />
    <circle cx="15.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="17" cy="13" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

export const NavTransactionsIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M4 7h12l-2-2M20 17H8l2 2" />
    <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
  </svg>
);

export const NavRoomsIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const NavAuditIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const NavDiscountIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M20.6 12.4 12.4 20.6a2 2 0 0 1-2.8 0l-7-7a1 1 0 0 1-.3-0.7V4a1 1 0 0 1 1-1h8.9a1 1 0 0 1 .7.3l7.7 7.7a1.5 1.5 0 0 1 0 2.4Z" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
);

export const NavRewardsIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V8Z" />
    <path d="M9 8v12" strokeDasharray="2 2" />
  </svg>
);

export const NavAccountingIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
    <path d="M7 9h10M7 13h6M15 13h2M7 17h4" />
  </svg>
);

export const NavEntriesIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    <path d="M16 4v4h4" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const NavCalendarIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.4" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const NavProfileIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M4.5 20c.6-3.6 3.7-6 7.5-6s6.9 2.4 7.5 6" />
  </svg>
);

export const NavFormIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </svg>
);

export const NavTableIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
    <path d="M3.5 10h17M3.5 15h17M10 4v16" />
  </svg>
);

export const NavPagesIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="6" y="3.5" width="13" height="14" rx="2" />
    <rect x="3.5" y="6" width="13" height="14" rx="2" />
  </svg>
);

export const NavKitchenIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M5 14a7 7 0 0 1 14 0v0H5v0Z" />
    <path d="M3.5 14h17M7 18h10" />
    <path d="M9 8c0-1.5 1.5-3 3-3s3 1.5 3 3" />
  </svg>
);

export const NavBarIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M5 4h14l-6 8v6h-2v-6L5 4Z" />
    <path d="M9 18h6" />
  </svg>
);

export const NavItemsIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
  </svg>
);

export const NavOrdersIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M5 7h14l-1.4 11a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 7Z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

export const NavClientsIcon: React.FC<IconProps> = NavUsersIcon;
