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
  NavDiscountIcon,
  NavRewardsIcon,
  NavAccountingIcon,
  NavEntriesIcon,
  NavCalendarIcon,
  NavProfileIcon,
  NavFormIcon,
  NavTableIcon,
  NavPagesIcon,
  NavKitchenIcon,
  NavBarIcon,
  NavItemsIcon,
  NavOrdersIcon,
} from "../components/common/NavIcons";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import SidebarWidget from "./SidebarWidget";
import KitchenDisplay from "../pages/Chef/KitchenDisplay";
import BarDisplay from "../pages/bartender/BarDisplay";
import BrandLogo from "../components/common/BrandLogo";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
  element?: React.ReactNode;
};

const baseNavItems: NavItem[] = [
  {
    icon: <NavDashboardIcon />,
    name: "Dashboard",
    subItems: [{ name: "Ecommerce", path: "/", pro: false }],
  },
  {
    icon: <NavCalendarIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <NavProfileIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    name: "Forms",
    icon: <NavFormIcon />,
    subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  },
  {
    name: "Tables",
    icon: <NavTableIcon />,
    subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  },
  {
    name: "Pages",
    icon: <NavPagesIcon />,
    subItems: [
      { name: "Blank Page", path: "/blank", pro: false },
      { name: "404 Error", path: "/error-404", pro: false },
    ],
  },
];

const baseOthersItems: NavItem[] = [];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { hasRole } = useAuth();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const computedNavItems = useMemo(() => {
    // Admin users get full admin navigation
    if (hasRole("admin")) {
      return [
        {
          icon: <NavDashboardIcon />,
          name: "Dashboard",
          subItems: [{ name: "Ecommerce", path: "/" }],
        },
        { icon: <NavMenuIcon />, name: "Menu", path: "/menu" },
        { icon: <NavUsersIcon />, name: "Users Management", path: "/admin/users" },
        {
          icon: <NavInventoryIcon />,
          name: "Inventory Management",
          subItems: [
            { name: "Items", path: "/admin/items" },
            { name: "Categories", path: "/admin/categories" },
            { name: "Orders", path: "/admin/orders" },
            { name: "QR Generator", path: "/admin/qr-generator" },
          ],
        },
        {
          icon: <NavInventoryIcon />,
          name: "Stock Management",
          subItems: [
            { name: "Ingredients", path: "/chef/ingredients" },
            { name: "Suppliers", path: "/chef/suppliers" },
            { name: "Purchases", path: "/chef/purchases" },
            { name: "Inventory Valuation", path: "/chef/inventory-valuation" },
            // The waste log is the same audit page filtered to Type=Waste.
            { name: "Waste Log", path: "/chef/stock-movements?type=Waste" },
            { name: "Stock Movements", path: "/chef/stock-movements" },
          ],
        },
        {
          icon: <NavGameIcon />,
          name: "Game",
          subItems: [
            { name: "Overview", path: "/admin/game" },
            { name: "Settings", path: "/admin/game-settings" },
          ],
        },
        {
          icon: <NavTransactionsIcon />,
          name: "Transactions",
          subItems: [
            { name: "Item Transactions", path: "/admin/transactions" },
            { name: "Game Transactions", path: "/admin/game-transactions" },
          ],
        },
        { icon: <NavRoomsIcon />, name: "Rooms", path: "/admin/rooms" },
        { name: 'Audit Logs', path: '/admin/audit-logs', icon: <NavAuditIcon /> },
        {
          name: 'AI Assistant',
          path: '/ai/chat',
          icon: (
            // Inline sparkle/AI icon — kept here so we don't have to edit NavIcons just for this
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ),
        },
        {
          name: 'Integrations',
          path: '/admin/integrations',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 7H6a3 3 0 00-3 3v4a3 3 0 003 3h3" />
              <path d="M15 7h3a3 3 0 013 3v4a3 3 0 01-3 3h-3" />
              <path d="M8 12h8" />
            </svg>
          ),
        },
        {
          name: 'Events',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="3.2" />
              <rect x="14" y="3.8" width="6.4" height="6.4" rx="1" />
              <path d="M7 14.5 L11 21.5 L3 21.5 Z" />
            </svg>
          ),
          subItems: [
            { name: 'Manage Events', path: '/admin/events' },
            { name: 'Registrations', path: '/admin/event-registrations' },
          ],
        },
        {
          name: 'Website',
          path: '/admin/website',
          icon: (
            // Globe glyph — public website content editor
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18" />
              <path d="M12 3a14 14 0 0 1 0 18" />
              <path d="M12 3a14 14 0 0 0 0 18" />
            </svg>
          ),
        },
        {
          name: 'COGS Rebuild',
          path: '/admin/consumption-rebuild',
          icon: (
            // Small "refresh + database" glyph
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v6c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
              <path d="M3 11v6c0 1.657 4.03 3 9 3s9-1.343 9-3v-6" />
              <path d="M15 21l2-2-2-2" />
            </svg>
          ),
        },
        { icon: <NavDiscountIcon />, name: "Discount Management", path: "/admin/discounts" },
        { icon: <NavDiscountIcon />, name: "Channels", path: "/admin/channels" },
        {
          name: "Printers",
          path: "/admin/printers",
          icon: (
            // Simple printer glyph
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          ),
        },
        // {
        //   icon: <DollarLineIcon />,
        //   name: "Profit",
        //   subItems: [
        //     { name: "Gaming Profit", path: "/admin/profit/gaming" },
        //     { name: "TCG Profit", path: "/admin/profit/tcg" },
        //     { name: "F&B Profit", path: "/admin/profit/fnb" },
        //     { name: "Overall Profit", path: "/admin/profit/overall" },
        //   ],
        // },
        {
        icon: <NavRewardsIcon />,
        name: "AXIS PLUS Rewards",
        subItems: [
          { name: "Customer Lookup", path: "/admin/loyalty/customers" },
          { name: "Leaderboard", path: "/admin/loyalty/leaderboard" },
          { name: "Conduct Draws", path: "/admin/loyalty/draws" },
          { name: "Wallets", path: "/admin/wallets" },
        ],
      },
      {
  icon: <NavAccountingIcon />,
  name: "Accounting",
  subItems: [
    { name: "Dashboard", path: "/accounting" },
    { name: "Item Revenue", path: "/accounting/item-revenue" },
    { name: "Chart of Accounts", path: "/accounting/accounts" },
    { name: "Trial Balance", path: "/accounting/trial-balance" },
    { name: "General Ledger", path: "/accounting/general-ledger" },
    { name: "Books Audit", path: "/accounting/audit" },
    { name: "Hierarchy Audit", path: "/accounting/hierarchy-audit" },
  ],
},
{
          icon: <NavEntriesIcon />,
          name: "Entries Management",
          subItems: [
            { name: "Entries", path: "/admin/expenses" },
            { name: "Categories", path: "/admin/expense-categories" },
          ],
        },
      ];
    }

    // Admin F&B: limited menu for food & beverage operations
    if (hasRole("admin_fnb")) {
      return [
        {
          icon: <NavDashboardIcon />,
          name: "Dashboard",
          path: "/admin-fnb/dashboard",
        },
        {
          icon: <NavInventoryIcon />,
          name: "F&B Management",
          subItems: [
            { name: "Items", path: "/admin-fnb/items" },
            { name: "Orders", path: "/admin-fnb/orders" },
          ],
        },
        { icon: <NavAccountingIcon />, name: "Profit", path: "/admin-fnb/profit" },
      ];
    }

    // GameCashie: limited menu for game cashier operations
    if (hasRole("GameCashier") || hasRole("gamecashier") || hasRole("game_cashier") || hasRole("cashiergame")) {
      return [
        { icon: <NavGameIcon />, name: "Game Session", path: "/game/sessions" },
        { icon: <NavGameIcon />, name: "PS5 Sessions", path: "/gamecashier/ps5-sessions" },
        { icon: <NavGameIcon />, name: "Board Games", path: "/gamecashier/board-sessions" },
        { icon: <NavItemsIcon />, name: "Items", path: "/gamecashier/items" },
        { icon: <NavOrdersIcon />, name: "Open Items Invoice", path: "/cashier/open-invoices" },
        { icon: <NavRoomsIcon />, name: "Rooms", path: "/gamecashier/rooms" },
        { icon: <NavUsersIcon />, name: "Clients", path: "/gamecashier/clients" },
        { icon: <NavGameIcon />, name: "Events", path: "/cashier/events" },
        { icon: <NavRewardsIcon />, name: "AXIS PLUS Check", path: "/cashier/loyalty-check" },
      ];
    }

    // Cashier: show Items and Orders as separate top-level links
    if (hasRole("cashier")) {
      return [
        { icon: <NavItemsIcon />, name: "Items", path: "/cashier/items" },
        { icon: <NavOrdersIcon />, name: "Orders", path: "/cashier/orders" },
        // Wallets are topped up from here, so the F&B till needs it too.
        { icon: <NavUsersIcon />, name: "Clients", path: "/gamecashier/clients" },
        { icon: <NavGameIcon />, name: "Events", path: "/cashier/events" },
        { icon: <NavRewardsIcon />, name: "AXIS PLUS Check", path: "/cashier/loyalty-check" },
      ];
    }

    // Chef: kitchen order management only
    if (hasRole("chef")) {
      return [
        { icon: <NavKitchenIcon />, name: "Kitchen Orders", path: "/chef/kitchen-display", element: <KitchenDisplay />, subItems: undefined },
      ];
    }

    // Stock: dedicated stock-management-only account. Sees the five
    // stock pages and nothing else — no sales, no accounting, no admin.
    if (hasRole("stock")) {
      return [
        { icon: <NavInventoryIcon />, name: "Ingredients", path: "/chef/ingredients" },
        { icon: <NavInventoryIcon />, name: "Stock Movements", path: "/chef/stock-movements" },
        { icon: <NavUsersIcon />, name: "Suppliers", path: "/chef/suppliers" },
        { icon: <NavOrdersIcon />, name: "Purchases", path: "/chef/purchases" },
        { icon: <NavTableIcon />, name: "Inventory Valuation", path: "/chef/inventory-valuation" },
      ];
    }


    if (hasRole("bartender")) {
      return [
        { icon: <NavBarIcon />, name: "Bar Orders", path: '/bartender/bar-display', element: <BarDisplay />, subItems: undefined },
      ];
    }

    return baseNavItems; // non-admin retains original navigation
  }, [hasRole]);

  const computedOthersItems = useMemo(() => {
    // Hide others section for admin, cashier, chef, and stock
    if (hasRole("admin") || hasRole("cashier") || hasRole("chef") || hasRole("stock")) return [];
    return baseOthersItems;
  }, [hasRole]);

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? computedNavItems : computedOthersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive, computedNavItems, computedOthersItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => {
        const isOpen = openSubmenu?.type === menuType && openSubmenu?.index === index;
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
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${isOpen || hasActiveChild
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={`menu-item-icon-size transition-colors  ${(isOpen || hasActiveChild)
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text font-medium">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-4 h-4 transition-transform duration-200 ${isOpen
                    ? "rotate-180 text-brand-500"
                    : "text-gray-400"
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  } ${!isExpanded && !isHovered ? "lg:justify-center" : ""}`}
              >
                <span
                  className={`menu-item-icon-size transition-colors ${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text font-medium">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height: isOpen ? `${subMenuHeight[`${menuType}-${index}`]}px` : "0px",
              }}
            >
              <ul className="mt-1 space-y-0.5 ml-6 pl-3 border-l border-gray-200/70 dark:border-white/5">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
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
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -top-20 -left-10 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-10 -right-10 w-56 h-56 rounded-full bg-accent-300/10 blur-3xl" aria-hidden="true" />

      <div
        className={`relative py-7 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start pl-2"
          }`}
      >
        <Link to="/" className="group inline-flex items-center transition-transform hover:scale-[1.02]">
          {isExpanded || isHovered || isMobileOpen ? (
            <BrandLogo variant="full" />
          ) : (
            <BrandLogo variant="icon" size={36} />
          )}
        </Link>
      </div>
      <div className="relative flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] flex leading-[20px] text-gray-400 dark:text-gray-500 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start pl-2"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-5" />
                )}
              </h2>
              {renderMenuItems(computedNavItems, "main")}
            </div>
            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  ""
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(computedOthersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
