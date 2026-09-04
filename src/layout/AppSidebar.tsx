// Dashboard sidebar, driven by the page catalogue (src/config/pages.ts).
// A page shows up when the signed-in user may open it — admins see every
// page, built-in roles keep their fixed pages, custom roles get whatever an
// admin granted under Roles & Permissions.
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon, HorizontaLDots } from "../icons";
import {
  NavDashboardIcon,
  NavMenuIcon,
  NavUsersIcon,
  NavInventoryIcon,
  NavGameIcon,
  NavTransactionsIcon,
  NavRoomsIcon,
  NavAuditIcon,
  NavRewardsIcon,
  NavAccountingIcon,
  NavEntriesIcon,
  NavTableIcon,
  NavKitchenIcon,
  NavBarIcon,
  NavItemsIcon,
  NavOrdersIcon,
} from "../components/common/NavIcons";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import SidebarWidget from "./SidebarWidget";
import BrandLogo from "../components/common/BrandLogo";
import { PAGES, PAGE_GROUPS } from "../config/pages";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

const EventsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="3.2" />
    <rect x="14" y="3.8" width="6.4" height="6.4" rx="1" />
    <path d="M7 14.5 L11 21.5 L3 21.5 Z" />
  </svg>
);
const GlobeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);
const ToolsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);
const ShieldIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const GROUP_ICONS: Record<string, React.ReactNode> = {
  Overview: <NavDashboardIcon />,
  People: <NavUsersIcon />,
  "Inventory Management": <NavInventoryIcon />,
  "Stock Management": <NavInventoryIcon />,
  Game: <NavGameIcon />,
  Transactions: <NavTransactionsIcon />,
  Venue: <NavRoomsIcon />,
  "Events & Website": EventsIcon,
  Tools: ToolsIcon,
  "AXIS PLUS Rewards": <NavRewardsIcon />,
  Accounting: <NavAccountingIcon />,
  "Entries Management": <NavEntriesIcon />,
  "F&B Admin": <NavInventoryIcon />,
  Till: <NavItemsIcon />,
  "Game Till": <NavGameIcon />,
  "Kitchen & Bar": <NavKitchenIcon />,
};

/** Icons for pages that render as their own top-level link. */
const PAGE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <NavDashboardIcon />,
  menu: <NavMenuIcon />,
  users: <NavUsersIcon />,
  roles: ShieldIcon,
  website: GlobeIcon,
  events: EventsIcon,
  "event-registrations": EventsIcon,
  "audit-logs": <NavAuditIcon />,
  "fnb-dashboard": <NavDashboardIcon />,
  "fnb-items": <NavItemsIcon />,
  "fnb-orders": <NavOrdersIcon />,
  "fnb-profit": <NavAccountingIcon />,
  "cashier-items": <NavItemsIcon />,
  "cashier-orders": <NavOrdersIcon />,
  "open-invoices": <NavOrdersIcon />,
  clients: <NavUsersIcon />,
  "cashier-events": EventsIcon,
  "loyalty-check": <NavRewardsIcon />,
  "game-sessions": <NavGameIcon />,
  "ps5-sessions": <NavGameIcon />,
  "board-sessions": <NavGameIcon />,
  "gamecashier-items": <NavItemsIcon />,
  "gamecashier-rooms": <NavRoomsIcon />,
  "kitchen-display": <NavKitchenIcon />,
  "kitchen-stats": <NavTableIcon />,
  "bar-display": <NavBarIcon />,
  "stock-ingredients": <NavInventoryIcon />,
  "stock-suppliers": <NavUsersIcon />,
  "stock-purchases": <NavOrdersIcon />,
  "stock-valuation": <NavTableIcon />,
  "stock-movements": <NavInventoryIcon />,
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { canAccess } = useAuth();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Entries with a query string (the waste log) match on the full URL.
  const isActive = useCallback(
    (path: string) =>
      path.includes("?") ? location.pathname + location.search === path : location.pathname === path,
    [location.pathname, location.search]
  );

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    const accessible = PAGES.filter((p) => canAccess(p.key));
    const groupsInUse = new Set(accessible.map((p) => p.group));
    // Till-style groups render as top-level links for till staff (whose whole
    // menu is one or two such groups). Users with a wider menu (admins) get
    // them folded into submenus so the list stays readable.
    const flatGroups = groupsInUse.size <= 2;

    for (const group of PAGE_GROUPS) {
      const pages = accessible.filter((p) => p.group === group.name);
      if (pages.length === 0) continue;

      // Overview (Dashboard, Menu) is always top-level.
      if ((group.flat && (flatGroups || group.name === "Overview")) || pages.length === 1) {
        for (const p of pages) {
          const icon = PAGE_ICONS[p.key] ?? GROUP_ICONS[group.name];
          if (p.navItems && p.navItems.length > 1) items.push({ name: p.label, icon, subItems: p.navItems });
          else items.push({ name: p.label, icon, path: p.navItems?.[0]?.path ?? p.path });
        }
      } else {
        items.push({
          name: group.name,
          icon: GROUP_ICONS[group.name],
          subItems: pages.flatMap((p) => p.navItems ?? [{ name: p.label, path: p.path }]),
        });
      }
    }
    return items;
  }, [canAccess]);

  // Open the submenu that contains the current page.
  useEffect(() => {
    const idx = navItems.findIndex((nav) => nav.subItems?.some((s) => isActive(s.path)));
    setOpenSubmenu(idx === -1 ? null : idx);
  }, [location, isActive, navItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `main-${openSubmenu}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({ ...prev, [key]: subMenuRefs.current[key]?.scrollHeight || 0 }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) => (prev === index ? null : index));
  };

  const showText = isExpanded || isHovered || isMobileOpen;

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => {
        const isOpen = openSubmenu === index;
        const hasActiveChild = nav.subItems?.some((s) => isActive(s.path));
        const isItemActive = nav.path ? isActive(nav.path) : !!hasActiveChild;
        return (
          <li key={nav.name} className="relative">
            {/* Active left indicator */}
            {isItemActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full gradient-brand shadow-glow-brand" aria-hidden="true" />
            )}
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(index)}
                className={`menu-item group ${isOpen || hasActiveChild ? "menu-item-active" : "menu-item-inactive"} cursor-pointer ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span className={`menu-item-icon-size transition-colors ${isOpen || hasActiveChild ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                  {nav.icon}
                </span>
                {showText && <span className="menu-item-text font-medium">{nav.name}</span>}
                {showText && (
                  <ChevronDownIcon
                    className={`ml-auto w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-brand-500" : "text-gray-400"}`}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"} ${
                    !isExpanded && !isHovered ? "lg:justify-center" : ""
                  }`}
                >
                  <span className={`menu-item-icon-size transition-colors ${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                    {nav.icon}
                  </span>
                  {showText && <span className="menu-item-text font-medium">{nav.name}</span>}
                </Link>
              )
            )}
            {nav.subItems && showText && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`main-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{ height: isOpen ? `${subMenuHeight[`main-${index}`]}px` : "0px" }}
              >
                <ul className="mt-1 space-y-0.5 ml-6 pl-3 border-l border-gray-200/70 dark:border-white/5">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.path}>
                      <Link
                        to={subItem.path}
                        className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-4 left-0 glass-panel text-gray-900 dark:text-white h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200/60 dark:border-white/5
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-20 -left-10 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-10 -right-10 w-56 h-56 rounded-full bg-accent-300/10 blur-3xl" aria-hidden="true" />

      <div className={`relative py-7 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start pl-2"}`}>
        <Link to="/dashboard" className="group inline-flex items-center transition-transform hover:scale-[1.02]">
          {showText ? <BrandLogo variant="full" /> : <BrandLogo variant="icon" size={36} />}
        </Link>
      </div>
      <div className="relative flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <h2
            className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] flex leading-[20px] text-gray-400 dark:text-gray-500 ${
              !isExpanded && !isHovered ? "lg:justify-center" : "justify-start pl-2"
            }`}
          >
            {showText ? "Menu" : <HorizontaLDots className="size-5" />}
          </h2>
          {navItems.length === 0 ? (
            showText && <p className="px-2 text-xs text-gray-400">No pages assigned to your role yet.</p>
          ) : (
            renderMenuItems(navItems)
          )}
        </nav>
        {showText ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
