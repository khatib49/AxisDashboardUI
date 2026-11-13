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
  /** A permission only (no page of its own): kept out of the sidebar. */
  hidden?: boolean;
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
  { name: "Gaming" },
  { name: "Promotions" },
  { name: "Marketing" },
  { name: "Owner" },
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
const TILL = ["cashier", "gamecashier", "admin_fnb"];

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
  { key: "online-payments", label: "Online Payments", group: "Accounting", path: "/admin/online-payments", legacyRoles: [] },
  { key: "shipments", label: "Shipping & Aramex", group: "Accounting", path: "/admin/shipments", legacyRoles: [] },
  { key: "owners-drawings", label: "Owners' Drawings", group: "Accounting", path: "/accounting/owners-drawings", legacyRoles: [] },
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
  { key: "online-orders", label: "Online Orders", group: "Till", path: "/cashier/online-orders", legacyRoles: ["cashier", "admin_fnb"] },
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

  // Added with the operations, gaming and owner modules (keys mirror PageCatalog.cs).
  { key: "stockops-locations", label: "Stock Locations", group: "Stock Management", path: "/stock/locations", legacyRoles: STOCK },
  { key: "stockops-counts", label: "Stocktakes", group: "Stock Management", path: "/stock/counts", legacyRoles: STOCK },
  { key: "stockops-transfers", label: "Stock Transfers", group: "Stock Management", path: "/stock/transfers", legacyRoles: STOCK },
  { key: "stockops-reorder", label: "Reorder Suggestions", group: "Stock Management", path: "/stock/reorder", legacyRoles: STOCK },
  { key: "stockops-batches", label: "Batches & Expiry", group: "Stock Management", path: "/stock/batches", legacyRoles: STOCK },
  { key: "stockops-positions", label: "Branch Stock Positions", group: "Stock Management", path: "/stock/positions", legacyRoles: STOCK },
  { key: "retail-barcodes", label: "Barcodes", group: "Inventory Management", path: "/admin/retail/barcodes", legacyRoles: [] },
  { key: "retail-labels", label: "Barcode Labels", group: "Inventory Management", path: "/admin/retail/labels", legacyRoles: [] },
  { key: "retail-serials", label: "Serial Numbers", group: "Inventory Management", path: "/admin/retail/serials", legacyRoles: [] },
  { key: "floor-plan", label: "Floor Plan", group: "Venue", path: "/admin/floor-plan", legacyRoles: [] },
  { key: "floor-view", label: "Floor", group: "Till", path: "/cashier/floor", legacyRoles: TILL },
  { key: "floor-reservations", label: "Reservations", group: "Venue", path: "/floor/reservations", legacyRoles: TILL },
  { key: "waiter", label: "Waiter", group: "Till", path: "/waiter", legacyRoles: TILL },
  { key: "till-shift", label: "My Shift", group: "Till", path: "/till/shift", legacyRoles: TILL },
  { key: "till-void-requests", label: "Void / Refund Requests", group: "Till", path: "/till/void-requests", legacyRoles: TILL },
  { key: "till-tenders", label: "Tenders (multi-currency)", group: "Till", path: "/till/tenders", legacyRoles: TILL },
  { key: "till-shifts-admin", label: "Cashier Shifts & Z Reports", group: "Transactions", path: "/admin/till/shifts", legacyRoles: [] },
  { key: "till-void-reasons", label: "Void Reasons", group: "Transactions", path: "/admin/till/void-reasons", legacyRoles: [] },
  { key: "currencies", label: "Currencies & Rates", group: "Accounting", path: "/admin/currencies", legacyRoles: [] },
  { key: "offline-status", label: "Offline Status", group: "Till", path: "/offline", legacyRoles: TILL },
  { key: "till-displays", label: "Customer Displays", group: "Till", path: "/admin/till/displays", legacyRoles: [] },
  { key: "whish-payments", label: "Whish Payments", group: "Till", path: "/cashier/open-invoices", legacyRoles: TILL, hidden: true },
  { key: "delivery-board", label: "Delivery & Takeaway", group: "Till", path: "/delivery/board", legacyRoles: TILL },
  { key: "delivery-new", label: "New Delivery Order", group: "Till", path: "/delivery/new", legacyRoles: TILL },
  { key: "delivery-zones", label: "Zones & Drivers", group: "F&B Admin", path: "/admin/delivery/zones-drivers", legacyRoles: [] },
  { key: "selforder-tables", label: "Self-Order Tables (QR)", group: "F&B Admin", path: "/admin/selforder/tables", legacyRoles: [] },
  { key: "kiosk-devices", label: "Kiosk Devices", group: "F&B Admin", path: "/admin/kiosk/devices", legacyRoles: [] },
  { key: "acctplus-bank", label: "Bank Reconciliation", group: "Accounting", path: "/accounting-plus/bank-reconciliation", legacyRoles: [] },
  { key: "acctplus-bills", label: "Supplier Bills", group: "Accounting", path: "/accounting-plus/supplier-bills", legacyRoles: [] },
  { key: "acctplus-aging", label: "AP / AR Aging", group: "Accounting", path: "/accounting-plus/aging", legacyRoles: [] },
  { key: "acctplus-vat", label: "VAT Report", group: "Accounting", path: "/accounting-plus/vat-report", legacyRoles: [] },
  { key: "acctplus-assets", label: "Fixed Assets", group: "Accounting", path: "/accounting-plus/fixed-assets", legacyRoles: [] },
  { key: "acctplus-periods", label: "Accounting Periods", group: "Accounting", path: "/accounting-plus/periods", legacyRoles: [] },
  { key: "menu-engineering", label: "Menu Engineering", group: "Accounting", path: "/accounting/menu-engineering", legacyRoles: ["admin_fnb"] },
  { key: "hr-employees", label: "Employees", group: "People", path: "/hr/employees", legacyRoles: [] },
  { key: "hr-schedule", label: "Shift Schedule", group: "People", path: "/hr/schedule", legacyRoles: [] },
  { key: "hr-attendance", label: "Attendance", group: "People", path: "/hr/attendance", legacyRoles: [] },
  { key: "hr-leave", label: "Leave", group: "People", path: "/hr/leave", legacyRoles: [] },
  { key: "hr-tips", label: "Tip Pools", group: "People", path: "/hr/tips", legacyRoles: TILL },
  { key: "hr-payroll", label: "Payroll", group: "People", path: "/hr/payroll", legacyRoles: [] },
  { key: "hr-pay-components", label: "Pay Components", group: "People", path: "/hr/pay-components", legacyRoles: [] },
  { key: "hr-clock", label: "Clock In / Out", group: "Till", path: "/hr/clock", legacyRoles: ["cashier", "gamecashier", "admin_fnb", "chef", "bartender"] },
  { key: "promo-giftcards", label: "Gift Cards", group: "Promotions", path: "/admin/promotions/gift-cards", legacyRoles: [] },
  { key: "promo-coupons", label: "Coupons", group: "Promotions", path: "/admin/promotions/coupons", legacyRoles: [] },
  { key: "promo-happyhours", label: "Happy Hours", group: "Promotions", path: "/admin/promotions/happy-hours", legacyRoles: [] },
  { key: "promo-combos", label: "Combos", group: "Promotions", path: "/admin/promotions/combos", legacyRoles: [] },
  { key: "menu-3d", label: "3D Menu", group: "Inventory Management", path: "/admin/menu-3d", legacyRoles: [] },
  { key: "upsells", label: "Upsells", group: "Promotions", path: "/admin/upsells", legacyRoles: [] },
  { key: "delivery-platforms", label: "Delivery Apps", group: "F&B Admin", path: "/admin/delivery/platforms", legacyRoles: [] },
  { key: "card-terminals", label: "Card Terminals", group: "Till", path: "/admin/payments/terminals", legacyRoles: [] },
  { key: "tournaments", label: "Tournaments", group: "Gaming", path: "/admin/tournaments", legacyRoles: TILL },
  { key: "bookings", label: "Station Bookings", group: "Gaming", path: "/admin/bookings", legacyRoles: TILL },
  { key: "station-codes", label: "Station QR Ordering", group: "Gaming", path: "/admin/station-codes", legacyRoles: [] },
  { key: "parent-wallet", label: "Parent Wallet", group: "Gaming", path: "/admin/parent-wallet", legacyRoles: TILL },
  { key: "owner-assistant", label: "Owner Assistant", group: "Owner", path: "/admin/owner-assistant", legacyRoles: [] },
  { key: "owner-alerts", label: "Owner Alerts", group: "Owner", path: "/admin/alerts", legacyRoles: [] },
  { key: "ai-tools", label: "AI Tools", group: "Owner", path: "/admin/ai/forecast", legacyRoles: [], navItems: [{ name: "AI Forecast", path: "/admin/ai/forecast" }, { name: "AI Menu Import", path: "/admin/ai/menu-import" }, { name: "AI Invoice Scan", path: "/admin/ai/invoice-scan" }] },
  { key: "setup", label: "Setup", group: "Owner", path: "/admin/setup", legacyRoles: [] },
  { key: "accounting-exports", label: "Accounting Exports", group: "Accounting", path: "/admin/accounting/exports", legacyRoles: [] },
  { key: "promo-accounting", label: "Promotion Accounting", group: "Promotions", path: "/admin/promotions/accounting", legacyRoles: [] },
  { key: "till-coupon-apply", label: "Apply Coupon", group: "Till", path: "/cashier/coupon", legacyRoles: TILL },
  { key: "branches", label: "Branches", group: "Venue", path: "/admin/branches", legacyRoles: [] },
  { key: "branches-consolidated", label: "Consolidated Dashboard", group: "Overview", path: "/admin/branches/consolidated", legacyRoles: [] },
  { key: "bi-scheduled-reports", label: "Scheduled Reports", group: "Tools", path: "/admin/bi/reports", legacyRoles: [] },
  { key: "bi-owner-view", label: "Owner View", group: "Overview", path: "/owner", legacyRoles: ["admin_fnb"] },
  { key: "marketing-segments", label: "Segments", group: "Marketing", path: "/admin/marketing/segments", legacyRoles: [] },
  { key: "marketing-campaigns", label: "Campaigns", group: "Marketing", path: "/admin/marketing/campaigns", legacyRoles: [] },
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
