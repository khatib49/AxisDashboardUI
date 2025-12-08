import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  DollarLineIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const baseNavItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [{ name: "Ecommerce", path: "/", pro: false }],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
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
          icon: <GridIcon />,
          name: "Dashboard",
          subItems: [{ name: "Ecommerce", path: "/" }],
        },
        { icon: <ListIcon />, name: "Menu", path: "/menu" },
        { icon: <UserCircleIcon />, name: "Users Management", path: "/admin/users" },
        {
          icon: <BoxCubeIcon />,
          name: "Inventory Management",
          subItems: [
            { name: "Items", path: "/admin/items" },
            { name: "Categories", path: "/admin/categories" },
            { name: "Orders", path: "/admin/orders" },
            { name: "QR Generator", path: "/admin/qr-generator" },
          ],
        },
        {
          icon: <PlugInIcon />,
          name: "Game",
          subItems: [
            { name: "Overview", path: "/admin/game" },
            { name: "Settings", path: "/admin/game-settings" },
          ],
        },
        {
          icon: <PieChartIcon />,
          name: "Transactions",
          subItems: [
            { name: "Item Transactions", path: "/admin/transactions" },
            { name: "Game Transactions", path: "/admin/game-transactions" },
          ],
        },
        { icon: <TableIcon />, name: "Rooms", path: "/admin/rooms" },
        {
          icon: <DollarLineIcon />,
          name: "Expenses Management",
          subItems: [
            { name: "Expenses", path: "/admin/expenses" },
            { name: "Categories", path: "/admin/expense-categories" },
          ],
        },
        { icon: <PieChartIcon />, name: "Discount Management", path: "/admin/discounts" },
        {
          icon: <DollarLineIcon />,
          name: "Profit",
          subItems: [
            { name: "Gaming Profit", path: "/admin/profit/gaming" },
            { name: "TCG Profit", path: "/admin/profit/tcg" },
            { name: "F&B Profit", path: "/admin/profit/fnb" },
            { name: "Overall Profit", path: "/admin/profit/overall" },
          ],
        },
      ];
    }

    // Admin F&B: limited menu for food & beverage operations
    if (hasRole("admin_fnb")) {
      return [
        {
          icon: <GridIcon />,
          name: "Dashboard",
          path: "/admin-fnb/dashboard",
        },
        {
          icon: <BoxCubeIcon />,
          name: "F&B Management",
          subItems: [
            { name: "Items", path: "/admin-fnb/items" },
            { name: "Orders", path: "/admin-fnb/orders" },
          ],
        },
        { icon: <DollarLineIcon />, name: "Profit", path: "/admin-fnb/profit" },
      ];
    }

    // GameCashie: limited menu for game cashier operations
    if (hasRole("GameCashier") || hasRole("gamecashier") || hasRole("game_cashier") || hasRole("cashiergame")) {
      return [
        // use non-admin paths so the GameCashie role isn't blocked by AdminRoute
        { icon: <PlugInIcon />, name: "Game Session", path: "/game/sessions" },
        { icon: <PlugInIcon />, name: "PS5 Sessions", path: "/gamecashier/ps5-sessions" },
        { icon: <PlugInIcon />, name: "Board Games", path: "/gamecashier/board-sessions" },
        { icon: <TableIcon />, name: "Rooms", path: "/gamecashier/rooms" },
        { icon: <BoxCubeIcon />, name: "Items", path: "/gamecashier/items" },
        { icon: <UserCircleIcon />, name: "Clients", path: "/gamecashier/clients" },
      ];
    }

    // Cashier: show Items and Orders as separate top-level links
    if (hasRole("cashier")) {
      return [
        { icon: <BoxCubeIcon />, name: "Items", path: "/cashier/items" },
        { icon: <TableIcon />, name: "Orders", path: "/cashier/orders" },
      ];
    }

    // Chef: kitchen order management only
    if (hasRole("chef")) {
      return [
        { icon: <ListIcon />, name: "Kitchen Orders", path: "/chef/orders" },
        { icon: <PieChartIcon />, name: "Statistics", path: "/chef/stats" },
      ];
    }

    return baseNavItems; // non-admin retains original navigation
  }, [hasRole]);

  const computedOthersItems = useMemo(() => {
    // Hide others section for admin, cashier, and chef
    if (hasRole("admin") || hasRole("cashier") || hasRole("chef")) return [];
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
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={`menu-item-icon-size  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`menu-item-icon-size ${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
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
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
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
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
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
      <div
        className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-center"
          }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark"
                src="/images/logo/axis-logo.jpeg"
                alt="Logo"
                width={150}
                height={40}

              />

            </>
          ) : (
            <img
              src="/images/logo/axis-logo-chrinked.jpeg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
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
