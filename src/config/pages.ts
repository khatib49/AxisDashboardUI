// The catalogue of dashboard pages a role can be granted.
//
// Mirrors Application/Security/PageCatalog.cs on the API — keep the keys in
// step. The sidebar, the route guards and the Roles & Permissions editor are
// all driven from this list, so adding a page here (plus a route in App.tsx)
// is all it takes to make it grantable.

export type PageDef = {
  key: string;
  label: string;
  group: string;
  path: string;
  /** Built-in roles that had this page before permissions became editable. */
  legacyRoles: string[];
  /** Extra sidebar entries for the same page (e.g. a filtered view). */
  navItems?: { name: string; path: string }[];
};

/** All spellings of the game-cashier role found in old tokens. */
export const GAMECASHIER_ALIASES = ["gamecashier", "GameCashier", "game_cashier", "cashiergame"];

/** Sidebar order of groups. Flat groups render as top-level links. */
export const PAGE_GROUPS: { name: string; flat?: boolean }[] = [
  { name: "Overview", flat: true },
  { name: "People" },
  { name: "Inventory Management" },
  { name: "Stock Management" },
  { name: "Game" },
  { name: "Transactions" },
  { name: "Venue" },
  { name: "Events & Website" },
  { name: "Tools" },
  { name: "AXIS PLUS Rewards" },
  { name: "Accounting" },
  { name: "Entries Management" },
  { name: "F&B Admin", flat: true },
  { name: "Till", flat: true },
  { name: "Game Till", flat: true },
  { name: "Kitchen & Bar", flat: true },
];

const STOCK = ["chef", "admin_fnb", "stock"];

export const PAGES: PageDef[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview", path: "/dashboard", legacyRoles: [] },
  { key: "menu", label: "Menu", group: "Overview", path: "/menu", legacyRoles: [] },

  { key: "users", label: "Users Management", group: "People", path: "/admin/users", legacyRoles: [] },
  { key: "roles", label: "Roles & Permissions", group: "People", path: "/admin/roles", legacyRoles: [] },

  { key: "items", label: "Items", group: "Inventory Management", path: "/admin/items", legacyRoles: [] },
  { key: "categories", label: "Categories", group: "Inventory Management", path: "/admin/categories", legacyRoles: [] },
  { key: "orders", label: "Orders", group: "Inventory Management", path: "/admin/orders", legacyRoles: [] },
  { key: "qr-generator", label: "QR Generator", group: "Inventory Management", path: "/admin/qr-generator", legacyRoles: [] },

  { key: "stock-ingredients", label: "Ingredients", group: "Stock Management", path: "/chef/ingredients", legacyRoles: STOCK },
  { key: "stock-suppliers", label: "Suppliers", group: "Stock Management", path: "/chef/suppliers", legacyRoles: STOCK },
  { key: "stock-purchases", label: "Purchases", group: "Stock Management", path: "/chef/purchases", legacyRoles: STOCK },
  { key: "stock-valuation", label: "Inventory Valuation", group: "Stock Management", path: "/chef/inventory-valuation", legacyRoles: STOCK },
  {
    key: "stock-movements", label: "Stock Movements", group: "Stock Management", path: "/chef/stock-movements", legacyRoles: STOCK,
    navItems: [
      { name: "Waste Log", path: "/chef/stock-movements?type=Waste" },
      { name: "Stock Movements", path: "/chef/stock-movements" },
    ],
  },

  { key: "game-overview", label: "Overview", group: "Game", path: "/admin/game", legacyRoles: [] },
  { key: "game-settings", label: "Settings", group: "Game", path: "/admin/game-settings", legacyRoles: [] },

  { key: "transactions-items", label: "Item Transactions", group: "Transactions", path: "/admin/transactions", legacyRoles: [] },
  { key: "transactions-game", label: "Game Transactions", group: "Transactions", path: "/admin/game-transactions", legacyRoles: [] },

  { key: "rooms", label: "Rooms", group: "Venue", path: "/admin/rooms", legacyRoles: [] },
  { key: "discounts", label: "Discount Management", group: "Venue", path: "/admin/discounts", legacyRoles: [] },
  { key: "channels", label: "Channels", group: "Venue", path: "/admin/channels", legacyRoles: [] },
  { key: "printers", label: "Printers", group: "Venue", path: "/admin/printers", legacyRoles: [] },

  { key: "events", label: "Manage Events", group: "Events & Website", path: "/admin/events", legacyRoles: [] },
  { key: "event-registrations", label: "Registrations", group: "Events & Website", path: "/admin/event-registrations", legacyRoles: [] },
  { key: "website", label: "Website", group: "Events & Website", path: "/admin/website", legacyRoles: [] },

  { key: "audit-logs", label: "Audit Logs", group: "Tools", path: "/admin/audit-logs", legacyRoles: [] },
  { key: "ai-assistant", label: "AI Assistant", group: "Tools", path: "/ai/chat", legacyRoles: [] },
  { key: "integrations", label: "Integrations", group: "Tools", path: "/admin/integrations", legacyRoles: [] },
  { key: "cogs-rebuild", label: "COGS Rebuild", group: "Tools", path: "/admin/consumption-rebuild", legacyRoles: [] },

  { key: "loyalty-customers", label: "Customer Lookup", group: "AXIS PLUS Rewards", path: "/admin/loyalty/customers", legacyRoles: [] },
  { key: "loyalty-leaderboard", label: "Leaderboard", group: "AXIS PLUS Rewards", path: "/admin/loyalty/leaderboard", legacyRoles: [] },
  { key: "loyalty-draws", label: "Conduct Draws", group: "AXIS PLUS Rewards", path: "/admin/loyalty/draws", legacyRoles: [] },
  { key: "wallets", label: "Wallets", group: "AXIS PLUS Rewards", path: "/admin/wallets", legacyRoles: [] },

  { key: "accounting", label: "Dashboard", group: "Accounting", path: "/accounting", legacyRoles: [] },
  { key: "accounting-item-revenue", label: "Item Revenue", group: "Accounting", path: "/accounting/item-revenue", legacyRoles: [] },
  { key: "accounting-accounts", label: "Chart of Accounts", group: "Accounting", path: "/accounting/accounts", legacyRoles: [] },
  { key: "accounting-trial-balance", label: "Trial Balance", group: "Accounting", path: "/accounting/trial-balance", legacyRoles: [] },
  { key: "accounting-ledger", label: "General Ledger", group: "Accounting", path: "/accounting/general-ledger", legacyRoles: [] },
  { key: "accounting-audit", label: "Books Audit", group: "Accounting", path: "/accounting/audit", legacyRoles: [] },
  { key: "accounting-hierarchy", label: "Hierarchy Audit", group: "Accounting", path: "/accounting/hierarchy-audit", legacyRoles: [] },

  { key: "expenses", label: "Entries", group: "Entries Management", path: "/admin/expenses", legacyRoles: [] },
  { key: "expense-categories", label: "Categories", group: "Entries Management", path: "/admin/expense-categories", legacyRoles: [] },

  { key: "fnb-dashboard", label: "Dashboard", group: "F&B Admin", path: "/admin-fnb/dashboard", legacyRoles: ["admin_fnb"] },
  { key: "fnb-items", label: "Items", group: "F&B Admin", path: "/admin-fnb/items", legacyRoles: ["admin_fnb"] },
  { key: "fnb-orders", label: "Orders", group: "F&B Admin", path: "/admin-fnb/orders", legacyRoles: ["admin_fnb"] },
  { key: "fnb-profit", label: "Profit", group: "F&B Admin", path: "/admin-fnb/profit", legacyRoles: ["admin_fnb"] },

  { key: "cashier-items", label: "Items", group: "Till", path: "/cashier/items", legacyRoles: ["cashier"] },
  { key: "cashier-orders", label: "Orders", group: "Till", path: "/cashier/orders", legacyRoles: ["cashier"] },
  { key: "open-invoices", label: "Open Items Invoice", group: "Till", path: "/cashier/open-invoices", legacyRoles: ["cashier", "gamecashier"] },
  { key: "clients", label: "Clients", group: "Till", path: "/gamecashier/clients", legacyRoles: ["cashier", "gamecashier", "admin_fnb"] },
  { key: "cashier-events", label: "Events", group: "Till", path: "/cashier/events", legacyRoles: ["cashier", "gamecashier", "admin_fnb"] },
  { key: "loyalty-check", label: "AXIS PLUS Check", group: "Till", path: "/cashier/loyalty-check", legacyRoles: ["cashier", "gamecashier"] },

  { key: "game-sessions", label: "Game Session", group: "Game Till", path: "/game/sessions", legacyRoles: ["gamecashier"] },
  { key: "ps5-sessions", label: "PS5 Sessions", group: "Game Till", path: "/gamecashier/ps5-sessions", legacyRoles: ["gamecashier"] },
  { key: "board-sessions", label: "Board Games", group: "Game Till", path: "/gamecashier/board-sessions", legacyRoles: ["gamecashier"] },
  { key: "gamecashier-items", label: "Items", group: "Game Till", path: "/gamecashier/items", legacyRoles: ["gamecashier"] },
  { key: "gamecashier-rooms", label: "Rooms", group: "Game Till", path: "/gamecashier/rooms", legacyRoles: ["gamecashier"] },

  { key: "kitchen-display", label: "Kitchen Orders", group: "Kitchen & Bar", path: "/chef/kitchen-display", legacyRoles: ["chef"] },
  { key: "kitchen-stats", label: "Kitchen Stats", group: "Kitchen & Bar", path: "/chef/stats", legacyRoles: ["chef"] },
  { key: "bar-display", label: "Bar Orders", group: "Kitchen & Bar", path: "/bartender/bar-display", legacyRoles: ["bartender"] },
];

export const PAGE_BY_KEY: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.key, p]));

/** Do the user's (built-in) roles grant this page by the old fixed rules? */
export function legacyAllows(page: PageDef, roles: string[]): boolean {
  if (page.legacyRoles.length === 0) return false;
  const have = new Set(roles.map((r) => (GAMECASHIER_ALIASES.includes(r) ? "gamecashier" : r)));
  return page.legacyRoles.some((r) => have.has(r));
}

/** Where a role that isn't one of the built-in ones should land after sign-in. */
export const LANDING_ORDER = PAGES.filter((p) => !["menu", "roles"].includes(p.key)).map((p) => p.key);
