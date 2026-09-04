import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import UsersManagement from "./pages/Admin/UsersManagement";
import Items from "./pages/Admin/Items";
import Cards from "./pages/Admin/Cards";
import CardTypes from "./pages/Admin/CardTypes";
import Game from "./pages/Admin/Game";
import GameSettings from "./pages/Admin/GameSettings";
import GameSessions from "./pages/Admin/GameSessions";
import Transactions from "./pages/Admin/Transactions";
import GameTransactions from "./pages/Admin/GameTransactions";
import Rooms from "./pages/Admin/Rooms";
import GameCashierRooms from "./pages/GameCashier/Rooms";
import Ps5Sessions from "./pages/GameCashier/Ps5Sessions";
import BoardGameSessions from "./pages/GameCashier/BoardGameSessions";
import Orders from "./pages/Admin/Orders";
import CategoryManagement from "./pages/Admin/CategoryManagement";
import CashierItems from './pages/Cashier/Items';
import CashierOrders from './pages/Cashier/Orders';
import GameSession from "./pages/Cashier/GameSession";
import SiteLayout from "./pages/Site/SiteLayout";
import SiteHome from "./pages/Site/SiteHome";
import SiteMenu from "./pages/Site/SiteMenu";
import SiteServices from "./pages/Site/SiteServices";
import SiteEvents from "./pages/Site/SiteEvents";
import SiteContact from "./pages/Site/SiteContact";
import WebsiteContent from "./pages/Admin/WebsiteContent";
import RolesManagement from "./pages/Admin/RolesManagement";
import { LANDING_ORDER, PAGE_BY_KEY } from "./config/pages";
import AdminFnBDashboard from './pages/AdminFnB/Dashboard';
import AdminFnBItems from './pages/AdminFnB/Items';
import AdminFnBOrders from './pages/AdminFnB/Orders';
import Expenses from './pages/Admin/Expenses';
import ExpenseCategories from './pages/Admin/ExpenseCategories';
import QRCodeGenerator from './pages/Admin/QRCodeGenerator';
import DiscountManagement from './pages/Admin/DiscountManagement';
import ClientManagement from './pages/GameCashier/ClientManagement';
import GamingProfit from './pages/Admin/GamingProfit';
import TcgProfit from './pages/Admin/TcgProfit';
import FnbProfit from './pages/Admin/FnbProfit';
import OverallProfit from './pages/Admin/OverallProfit';
import KitchenStats from './pages/Chef/KitchenStats';
import LoyaltyCheck from './pages/Cashier/LoyaltyCheck';
import LoyaltyCustomers from './pages/Admin/LoyaltyCustomers';
import Wallets from './pages/Admin/Wallets';
import EventsBoard from './pages/Cashier/EventsBoard';
import LoyaltyLeaderboard from './pages/Admin/LoyaltyLeaderboard';
import LoyaltyDraws from './pages/Admin/LoyaltyDraws';
import OpenInvoices from './pages/Cashier/OpenInvoices';
import AccountingDashboard from './pages/Accounting/AccountingDashboard';
import ChartOfAccounts from './components/Accounting/ChartOfAccounts';
import TrialBalance from './components/Accounting/TrialBalance';
import GeneralLedger from './components/Accounting/GeneralLedger';
import KitchenDisplay from "./pages/Chef/KitchenDisplay";
import BarDisplay from "./pages/bartender/BarDisplay";
import { AuditLogsPage } from "./pages/Admin/AuditLogsPage";
import AiChatPage from "./pages/Ai/AiChatPage";
import ConsumptionRebuild from "./pages/Admin/ConsumptionRebuild";
import EventRegistrationPage from "./pages/Events/EventRegistrationPage";
import EventRegistrations from "./pages/Admin/EventRegistrations";
import EventsManager from "./pages/Admin/EventsManager";
import IntegrationsPage from "./pages/Admin/Integrations";
import ItemRevenueReport from "./pages/Accounting/ItemRevenueReport";
import BooksAudit from "./pages/Accounting/BooksAudit";
import HierarchyAudit from "./pages/Accounting/HierarchyAudit";
import Ingredients from "./pages/Chef/Ingredients";
import StockMovements from "./pages/Chef/StockMovements";
import Suppliers from "./pages/Chef/Suppliers";
import Purchases from "./pages/Chef/Purchases";
import InventoryValuation from "./pages/Chef/InventoryValuation";
import Channels from "./pages/Admin/Channels";
import Printers from "./pages/Admin/Printers";

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authenticated, loading } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  return children;
};

// Page-level guard. A page is open to admins, to the built-in roles that
// always had it, and to any role granted it under Admin → Roles & Permissions.
const PageRoute: React.FC<{ page: string; children: React.ReactElement }> = ({ page, children }) => {
  const { authenticated, loading, canAccess, pagesReady } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (canAccess(page)) return children;
  if (!pagesReady) return <div className="p-6 text-center">Loading...</div>;
  return <Navigate to="/dashboard" replace />;
};


export default function App() {
  // Role-based home element: redirect non-admin operational roles away from dashboard
  const RoleHome: React.FC = () => {
    const { hasRole, canAccess, pagesReady } = useAuth();
    if (hasRole("cashier")) {
      return <Navigate to="/cashier/items" replace />;
    }
    if (hasRole("GameCashier") || hasRole("gamecashier") || hasRole("game_cashier") || hasRole("cashiergame")) {
      return <Navigate to="/game/sessions" replace />;
    }
    if (hasRole("admin_fnb")) {
      return <Navigate to="/admin-fnb/dashboard" replace />;
    }
    
    if (hasRole("chef")) {
      return <Navigate to="/chef/kitchen-display" replace />;
    }

    // Stock-only account: lands directly on Ingredients — the rest of
    // the stock pages are reachable from its dedicated sidebar section.
    if (hasRole("stock")) {
      return <Navigate to="/chef/ingredients" replace />;
    }

    if (hasRole("bartender")) {
      return <Navigate to="/bartender/bar-display" replace />;
    }

    if (hasRole("admin")) return <Home />;

    // Custom role (Admin → Roles & Permissions): land on its first page.
    if (!pagesReady) return <div className="p-6 text-center">Loading...</div>;
    const first = LANDING_ORDER.find((k) => k !== "dashboard" && canAccess(k));
    if (first) return <Navigate to={PAGE_BY_KEY[first].path} replace />;
    if (canAccess("dashboard")) return <Home />;
    return (
      <div className="p-10 text-center text-gray-500">
        No pages have been assigned to your role yet. Ask an administrator to grant access under Roles &amp; Permissions.
      </div>
    );
  };

  return (
    <>
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            {/* Public AXIS website — the root of the domain, no sign-in needed.
                Staff land on their dashboard at /dashboard. */}
            <Route element={<SiteLayout />}>
              <Route path="/" element={<SiteHome />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/menu" element={<SiteMenu />} />
              <Route path="/services" element={<SiteServices />} />
              <Route path="/events" element={<SiteEvents />} />
              <Route path="/contact" element={<SiteContact />} />
            </Route>

            {/* Public event registration — anonymous, no app layout.
                Fully data-driven: any event created under Admin → Events
                is reachable at /events/<its-slug>. /paid is where the
                payment gateways redirect after a successful charge. */}
            <Route path="/events/:eventKey" element={<EventRegistrationPage />} />
            <Route path="/events/:eventKey/paid" element={<EventRegistrationPage />} />

            {/* Dashboard Layout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              {/* Dashboard home — role-based landing for signed-in staff */}
              <Route path="/dashboard" element={<RoleHome />} />

              {/* Others Page */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blank" element={<Blank />} />

              {/* Forms */}
              <Route path="/form-elements" element={<FormElements />} />

              {/* Tables */}
              <Route path="/basic-tables" element={<BasicTables />} />

              {/* Ui Elements */}
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/avatars" element={<Avatars />} />
              <Route path="/badge" element={<Badges />} />
              <Route path="/buttons" element={<Buttons />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />

              {/* Charts */}
              <Route path="/line-chart" element={<LineChart />} />
              <Route path="/bar-chart" element={<BarChart />} />

              {/* Admin (guard inside element) */}
              <Route path="/admin/users" element={<PageRoute page="users"><UsersManagement /></PageRoute>} />
              <Route path="/admin/audit-logs" element={<PageRoute page="audit-logs"><AuditLogsPage /></PageRoute>} />
              <Route path="/ai/chat" element={<PageRoute page="ai-assistant"><AiChatPage /></PageRoute>} />
              <Route path="/admin/integrations" element={<PageRoute page="integrations"><IntegrationsPage /></PageRoute>} />
              <Route path="/admin/consumption-rebuild" element={<PageRoute page="cogs-rebuild"><ConsumptionRebuild /></PageRoute>} />
              <Route path="/admin/events" element={<PageRoute page="events"><EventsManager /></PageRoute>} />
              <Route path="/admin/event-registrations" element={<PageRoute page="event-registrations"><EventRegistrations /></PageRoute>} />
              <Route path="/admin/website" element={<PageRoute page="website"><WebsiteContent /></PageRoute>} />
              <Route path="/admin/roles" element={<PageRoute page="roles"><RolesManagement /></PageRoute>} />
              <Route path="/admin/items" element={<PageRoute page="items"><Items /></PageRoute>} />
              <Route path="/admin/orders" element={<PageRoute page="orders"><Orders /></PageRoute>} />
              <Route path="/cashier/items" element={<PageRoute page="cashier-items"><CashierItems /></PageRoute>} />
              <Route path="/cashier/orders" element={<PageRoute page="cashier-orders"><CashierOrders /></PageRoute>} />
              <Route path="/admin/cards" element={<PageRoute page="loyalty-customers"><Cards /></PageRoute>} />
              <Route path="/admin/card-types" element={<PageRoute page="loyalty-customers"><CardTypes /></PageRoute>} />
              <Route path="/admin/game" element={<PageRoute page="game-overview"><Game /></PageRoute>} />
              <Route path="/admin/game-settings" element={<PageRoute page="game-settings"><GameSettings /></PageRoute>} />
              <Route path="/admin/game-sessions" element={<PageRoute page="transactions-game"><GameSessions /></PageRoute>} />
              <Route path="/admin/transactions" element={<PageRoute page="transactions-items"><Transactions /></PageRoute>} />
              <Route path="/admin/game-transactions" element={<PageRoute page="transactions-game"><GameTransactions /></PageRoute>} />
              <Route path="/admin/rooms" element={<PageRoute page="rooms"><Rooms /></PageRoute>} />
              <Route path="/admin/categories" element={<PageRoute page="categories"><CategoryManagement /></PageRoute>} />
              <Route path="/admin/qr-generator" element={<PageRoute page="qr-generator"><QRCodeGenerator /></PageRoute>} />
              <Route path="/admin/discounts" element={<PageRoute page="discounts"><DiscountManagement /></PageRoute>} />
              <Route path="/admin/channels" element={<PageRoute page="channels"><Channels /></PageRoute>} />
              <Route path="/admin/printers" element={<PageRoute page="printers"><Printers /></PageRoute>} />
              <Route path="/admin/expenses" element={<PageRoute page="expenses"><Expenses /></PageRoute>} />
              <Route path="/admin/expense-categories" element={<PageRoute page="expense-categories"><ExpenseCategories /></PageRoute>} />
              <Route path="/admin/wallets" element={<PageRoute page="wallets"><Wallets /></PageRoute>} />
              <Route path="/admin/loyalty/customers" element={<ProtectedRoute><LoyaltyCustomers /></ProtectedRoute>} />
              <Route path="/admin/loyalty/leaderboard" element={<ProtectedRoute><LoyaltyLeaderboard /></ProtectedRoute>} />
              <Route path="/admin/loyalty/draws" element={<ProtectedRoute><LoyaltyDraws /></ProtectedRoute>} />

              {/* Admin Profit routes */}
              <Route path="/admin/profit/gaming" element={<PageRoute page="dashboard"><GamingProfit /></PageRoute>} />
              <Route path="/admin/profit/tcg" element={<PageRoute page="dashboard"><TcgProfit /></PageRoute>} />
              <Route path="/admin/profit/fnb" element={<PageRoute page="dashboard"><FnbProfit /></PageRoute>} />
              <Route path="/admin/profit/overall" element={<PageRoute page="dashboard"><OverallProfit /></PageRoute>} />

              {/* Admin F&B routes */}
              <Route path="/admin-fnb/dashboard" element={<PageRoute page="fnb-dashboard"><AdminFnBDashboard /></PageRoute>} />
              <Route path="/admin-fnb/profit" element={<PageRoute page="fnb-profit"><FnbProfit /></PageRoute>} />
              <Route path="/admin-fnb/items" element={<PageRoute page="fnb-items"><AdminFnBItems /></PageRoute>} />
              <Route path="/admin-fnb/orders" element={<PageRoute page="fnb-orders"><AdminFnBOrders /></PageRoute>} />

              {/* Chef routes */}
              <Route path="/chef/stats" element={<PageRoute page="kitchen-stats"><KitchenStats /></PageRoute>} />
              <Route path="/chef/kitchen-display" element={<PageRoute page="kitchen-display"><KitchenDisplay /></PageRoute>} />
              {/* Stock management — chef + admin + admin_fnb */}
              <Route path="/chef/ingredients" element={<PageRoute page="stock-ingredients"><Ingredients /></PageRoute>} />
              <Route path="/chef/stock-movements" element={<PageRoute page="stock-movements"><StockMovements /></PageRoute>} />
              <Route path="/chef/suppliers" element={<PageRoute page="stock-suppliers"><Suppliers /></PageRoute>} />
              <Route path="/chef/purchases" element={<PageRoute page="stock-purchases"><Purchases /></PageRoute>} />
              <Route path="/chef/inventory-valuation" element={<PageRoute page="stock-valuation"><InventoryValuation /></PageRoute>} />

              {/* Accounting routes */}
              <Route path="/accounting" element={<PageRoute page="accounting"><AccountingDashboard /></PageRoute>} />
              <Route path="/accounting/item-revenue" element={<PageRoute page="accounting-item-revenue"><ItemRevenueReport /></PageRoute>} />
              <Route path="/accounting/accounts" element={<PageRoute page="accounting-accounts"><ChartOfAccounts /></PageRoute>} />
              <Route path="/accounting/trial-balance" element={<PageRoute page="accounting-trial-balance"><TrialBalance /></PageRoute>} />
              <Route path="/accounting/general-ledger" element={<PageRoute page="accounting-ledger"><GeneralLedger /></PageRoute>} />
              <Route path="/accounting/audit" element={<PageRoute page="accounting-audit"><BooksAudit /></PageRoute>} />
              <Route path="/accounting/hierarchy-audit" element={<PageRoute page="accounting-hierarchy"><HierarchyAudit /></PageRoute>} />

              {/* BarTender routes */}
              <Route path="/bartender/bar-display" element={<PageRoute page="bar-display"><BarDisplay /></PageRoute>} />


              {/* GameCashie routes (non-admin paths) */}
              <Route path="/game/sessions" element={<PageRoute page="game-sessions"><GameSession /></PageRoute>} />
              <Route path="/gamecashier/rooms" element={<PageRoute page="gamecashier-rooms"><GameCashierRooms /></PageRoute>} />
              <Route path="/gamecashier/ps5-sessions" element={<PageRoute page="ps5-sessions"><Ps5Sessions /></PageRoute>} />
              <Route path="/gamecashier/board-sessions" element={<PageRoute page="board-sessions"><BoardGameSessions /></PageRoute>} />
              <Route path="/cashier/loyalty-check" element={<ProtectedRoute>
     <LoyaltyCheck />
        </ProtectedRoute>
    } 
/>
              
            <Route path="/cashier/open-invoices" element={<ProtectedRoute><OpenInvoices /></ProtectedRoute>} />
            
              {/* Make Cashier Items also available to game cashier roles */}
              <Route path="/gamecashier/items" element={<PageRoute page="gamecashier-items"><CashierItems /></PageRoute>} />
              {/* Every till needs this — it's where wallets get topped up. */}
              <Route path="/gamecashier/clients" element={<PageRoute page="clients"><ClientManagement /></PageRoute>} />
              {/* Today's + upcoming events, and cashier quick-create. */}
              <Route path="/cashier/events" element={<PageRoute page="cashier-events"><EventsBoard /></PageRoute>} />
            </Route>

            {/* Auth Layout */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}
