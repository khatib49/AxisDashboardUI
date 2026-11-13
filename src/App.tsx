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
import SiteShop from "./pages/Site/SiteShop";
import SitePolicies from "./pages/Site/SitePolicies";
import Shipments from "./pages/Admin/Shipments";
import SiteServices from "./pages/Site/SiteServices";
import SiteEvents from "./pages/Site/SiteEvents";
import PayPage from "./pages/Pay/PayPage";
import CartPage from "./pages/Shop/CartPage";
import CheckoutPage from "./pages/Shop/CheckoutPage";
import AccountPage from "./pages/Shop/AccountPage";
import OrderPage from "./pages/Shop/OrderPage";
import OnlineOrders from "./pages/Cashier/OnlineOrders";
import OnlinePayments from "./pages/Admin/OnlinePayments";
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
import TicketPage from "./pages/Events/TicketPage";
import EventRegistrations from "./pages/Admin/EventRegistrations";
import EventsManager from "./pages/Admin/EventsManager";
import IntegrationsAdmin from "./pages/Phase5/IntegrationsAdmin";
import IntegrationsPage from "./pages/Admin/Integrations";
import ItemRevenueReport from "./pages/Accounting/ItemRevenueReport";
import BooksAudit from "./pages/Accounting/BooksAudit";
import HierarchyAudit from "./pages/Accounting/HierarchyAudit";
import OwnersDrawings from "./pages/Accounting/OwnersDrawings";
import Ingredients from "./pages/Chef/Ingredients";
import StockMovements from "./pages/Chef/StockMovements";
import Suppliers from "./pages/Chef/Suppliers";
import Purchases from "./pages/Chef/Purchases";
import InventoryValuation from "./pages/Chef/InventoryValuation";
import Channels from "./pages/Admin/Channels";
import Printers from "./pages/Admin/Printers";
import StockLocations from "./pages/StockOps/Locations";
import StockCounts from "./pages/StockOps/StockCounts";
import StockTransfers from "./pages/StockOps/StockTransfers";
import ReorderSuggestions from "./pages/StockOps/ReorderSuggestions";
import StockBatches from "./pages/StockOps/Batches";
import FloorPlanAdmin from "./pages/Floor/FloorPlanAdmin";
import FloorView from "./pages/Floor/FloorView";
import Reservations from "./pages/Floor/Reservations";
import ReservationRequest from "./pages/Floor/ReservationRequest";
import BankReconciliation from "./pages/AccountingPlus/BankReconciliation";
import SupplierBills from "./pages/AccountingPlus/SupplierBills";
import Aging from "./pages/AccountingPlus/Aging";
import VatReport from "./pages/AccountingPlus/VatReport";
import FixedAssets from "./pages/AccountingPlus/FixedAssets";
import Periods from "./pages/AccountingPlus/Periods";
import Branches from "./pages/Branches/Branches";
import Consolidated from "./pages/Branches/Consolidated";
import ScheduledReports from "./pages/Bi/ScheduledReports";
import OwnerView from "./pages/Bi/OwnerView";
import OfflineStatus from "./pages/Offline/OfflineStatus";
import ShiftPanel from "./pages/Till/ShiftPanel";
import ShiftsAdmin from "./pages/Till/ShiftsAdmin";
import VoidRequests from "./pages/Till/VoidRequests";
import VoidReasons from "./pages/Till/VoidReasons";
import Currencies from "./pages/Till/Currencies";
import Tenders from "./pages/Till/Tenders";
import GiftCards from "./pages/Promotions/GiftCards";
import Coupons from "./pages/Promotions/Coupons";
import HappyHours from "./pages/Promotions/HappyHours";
import Combos from "./pages/Promotions/Combos";
import CouponApply from "./pages/Promotions/CouponApply";
import HrEmployees from "./pages/Hr/Employees";
import HrSchedule from "./pages/Hr/Schedule";
import HrAttendance from "./pages/Hr/Attendance";
import HrClockKiosk from "./pages/Hr/ClockKiosk";
import HrLeave from "./pages/Hr/Leave";
import HrTipPools from "./pages/Hr/TipPools";
import DeliveryBoard from "./pages/Delivery/DeliveryBoard";
import NewDeliveryOrder from "./pages/Delivery/NewDeliveryOrder";
import ZonesDrivers from "./pages/Delivery/ZonesDrivers";
import SelfOrderTablesAdmin from "./pages/SelfOrder/SelfOrderTablesAdmin";
import SelfOrderPage from "./pages/SelfOrder/SelfOrderPage";
import KioskPage from "./pages/Kiosk/KioskPage";
import KioskDevicesAdmin from "./pages/Kiosk/KioskDevicesAdmin";
import MenuEngineering from "./pages/MenuEngineering/MenuEngineering";
import CustomerDisplayPage from "./pages/CustomerDisplay/CustomerDisplayPage";
import DisplaysAdmin from "./pages/CustomerDisplay/DisplaysAdmin";
import WaiterHome from "./pages/Waiter/WaiterHome";
import WaiterTable from "./pages/Waiter/WaiterTable";
import WaiterOrder from "./pages/Waiter/WaiterOrder";
import MarketingSegments from "./pages/Marketing/Segments";
import MarketingCampaigns from "./pages/Marketing/Campaigns";
import HrPayroll from "./pages/Hr/Payroll";
import HrPayComponents from "./pages/Hr/PayComponents";
import RetailBarcodes from "./pages/Retail/Barcodes";
import Menu3DAdmin from "./pages/Phase4/Menu3DAdmin";
import TournamentsAdmin from "./pages/Phase5/TournamentsAdmin";
import BookingsAdmin from "./pages/Phase5/BookingsAdmin";
import StationCodesAdmin from "./pages/Phase5/StationCodesAdmin";
import ParentWalletAdmin from "./pages/Phase5/ParentWalletAdmin";
import OwnerAssistantAdmin from "./pages/Phase5/OwnerAssistantAdmin";
import AlertsAdmin from "./pages/Phase5/AlertsAdmin";
import AiForecast from "./pages/Phase5/AiForecast";
import AiMenuImport from "./pages/Phase5/AiMenuImport";
import AiInvoiceScan from "./pages/Phase5/AiInvoiceScan";
import SetupWizard from "./pages/Phase5/SetupWizard";
import AccountingExports from "./pages/Phase5/AccountingExports";
import TournamentPublic, { TournamentListPublic } from "./pages/Phase5/public/TournamentPublic";
import BookPublic, { BookingStatusPublic } from "./pages/Phase5/public/BookPublic";
import StationPublic from "./pages/Phase5/public/StationPublic";
import ParentPublic from "./pages/Phase5/public/ParentPublic";
import UpsellsAdmin from "./pages/Phase4/UpsellsAdmin";
import DeliveryPlatformsAdmin from "./pages/Phase4/DeliveryPlatformsAdmin";
import CardTerminalsAdmin from "./pages/Phase4/CardTerminalsAdmin";
import RetailLabels from "./pages/Retail/Labels";
import RetailSerials from "./pages/Retail/Serials";
import PromotionAccounting from "./pages/Promotions/PromotionAccounting";
import BranchPositions from "./pages/StockOps/BranchPositions";

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
              <Route path="/shop" element={<SiteShop />} />
              <Route path="/services" element={<SiteServices />} />
              <Route path="/events" element={<SiteEvents />} />
              <Route path="/contact" element={<SiteContact />} />
              {/* Legal pages required by the card acquirer (MontyPay) */}
              <Route path="/terms" element={<SitePolicies policy="terms" />} />
              <Route path="/privacy" element={<SitePolicies policy="privacy" />} />
              <Route path="/shipping-policy" element={<SitePolicies policy="shipping" />} />
              <Route path="/refund-policy" element={<SitePolicies policy="refunds" />} />
              {/* Shop: cart → sign in → checkout → order tracking */}
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/orders/:code" element={<OrderPage />} />
            </Route>

            {/* Public event registration — anonymous, no app layout.
                Fully data-driven: any event created under Admin → Events
                is reachable at /events/<its-slug>. /paid is where the
                payment gateways redirect after a successful charge. */}
            <Route path="/events/:eventKey" element={<EventRegistrationPage />} />
            <Route path="/events/:eventKey/paid" element={<EventRegistrationPage />} />
            {/* Public ticket — the code in the URL is the secret. */}
            <Route path="/tickets/:code" element={<TicketPage />} />

            {/* Public pay page — the link AXIS hands out for anything paid
                online. /result is where the gateway sends the customer back. */}
            <Route path="/pay/:code" element={<PayPage />} />
            <Route path="/pay/:code/result" element={<PayPage result />} />
            <Route path="/reserve" element={<ReservationRequest />} />
            <Route path="/order/:tableCode" element={<SelfOrderPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/display" element={<CustomerDisplayPage />} />
            <Route path="/t" element={<TournamentListPublic />} />
            <Route path="/t/:token" element={<TournamentPublic />} />
            <Route path="/book" element={<BookPublic />} />
            <Route path="/book/:token" element={<BookingStatusPublic />} />
            <Route path="/station/:token" element={<StationPublic />} />
            <Route path="/parent/:token" element={<ParentPublic />} />
            <Route path="/admin/retail/labels" element={<PageRoute page="retail-labels"><RetailLabels /></PageRoute>} />
            <Route path="/waiter" element={<PageRoute page="waiter"><WaiterHome /></PageRoute>} />
            <Route path="/waiter/table/:tableId" element={<PageRoute page="waiter"><WaiterTable /></PageRoute>} />
            <Route path="/waiter/order/:tableId" element={<PageRoute page="waiter"><WaiterOrder /></PageRoute>} />

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
              <Route path="/admin/integrations/all" element={<PageRoute page="integrations"><IntegrationsAdmin /></PageRoute>} />
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
              <Route path="/admin/online-payments" element={<PageRoute page="online-payments"><OnlinePayments /></PageRoute>} />
              <Route path="/admin/shipments" element={<PageRoute page="shipments"><Shipments /></PageRoute>} />
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
              <Route path="/accounting/owners-drawings" element={<PageRoute page="owners-drawings"><OwnersDrawings /></PageRoute>} />
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
            <Route path="/cashier/online-orders" element={<PageRoute page="online-orders"><OnlineOrders /></PageRoute>} />
            
              {/* Make Cashier Items also available to game cashier roles */}
              <Route path="/gamecashier/items" element={<PageRoute page="gamecashier-items"><CashierItems /></PageRoute>} />
              {/* Every till needs this — it's where wallets get topped up. */}
              <Route path="/gamecashier/clients" element={<PageRoute page="clients"><ClientManagement /></PageRoute>} />
              {/* Today's + upcoming events, and cashier quick-create. */}
              <Route path="/cashier/events" element={<PageRoute page="cashier-events"><EventsBoard /></PageRoute>} />
              <Route path="/stock/locations" element={<PageRoute page="stockops-locations"><StockLocations /></PageRoute>} />
              <Route path="/stock/counts" element={<PageRoute page="stockops-counts"><StockCounts /></PageRoute>} />
              <Route path="/stock/transfers" element={<PageRoute page="stockops-transfers"><StockTransfers /></PageRoute>} />
              <Route path="/stock/reorder" element={<PageRoute page="stockops-reorder"><ReorderSuggestions /></PageRoute>} />
              <Route path="/stock/batches" element={<PageRoute page="stockops-batches"><StockBatches /></PageRoute>} />
              <Route path="/stock/positions" element={<PageRoute page="stockops-positions"><BranchPositions /></PageRoute>} />
              <Route path="/admin/retail/barcodes" element={<PageRoute page="retail-barcodes"><RetailBarcodes /></PageRoute>} />
              <Route path="/admin/menu-3d" element={<PageRoute page="menu-3d"><Menu3DAdmin /></PageRoute>} />
              <Route path="/admin/tournaments" element={<PageRoute page="tournaments"><TournamentsAdmin /></PageRoute>} />
              <Route path="/admin/bookings" element={<PageRoute page="bookings"><BookingsAdmin /></PageRoute>} />
              <Route path="/admin/parent-wallet" element={<PageRoute page="parent-wallet"><ParentWalletAdmin /></PageRoute>} />
              <Route path="/admin/station-codes" element={<PageRoute page="station-codes"><StationCodesAdmin /></PageRoute>} />
              <Route path="/admin/owner-assistant" element={<PageRoute page="owner-assistant"><OwnerAssistantAdmin /></PageRoute>} />
              <Route path="/admin/alerts" element={<PageRoute page="owner-alerts"><AlertsAdmin /></PageRoute>} />
              <Route path="/admin/ai/forecast" element={<PageRoute page="ai-tools"><AiForecast /></PageRoute>} />
              <Route path="/admin/ai/menu-import" element={<PageRoute page="ai-tools"><AiMenuImport /></PageRoute>} />
              <Route path="/admin/ai/invoice-scan" element={<PageRoute page="ai-tools"><AiInvoiceScan /></PageRoute>} />
              <Route path="/admin/setup" element={<PageRoute page="setup"><SetupWizard /></PageRoute>} />
              <Route path="/admin/accounting/exports" element={<PageRoute page="accounting-exports"><AccountingExports /></PageRoute>} />
              <Route path="/admin/upsells" element={<PageRoute page="upsells"><UpsellsAdmin /></PageRoute>} />
              <Route path="/admin/delivery/platforms" element={<PageRoute page="delivery-platforms"><DeliveryPlatformsAdmin /></PageRoute>} />
              <Route path="/admin/payments/terminals" element={<PageRoute page="card-terminals"><CardTerminalsAdmin /></PageRoute>} />
              <Route path="/admin/retail/serials" element={<PageRoute page="retail-serials"><RetailSerials /></PageRoute>} />
              <Route path="/admin/floor-plan" element={<PageRoute page="floor-plan"><FloorPlanAdmin /></PageRoute>} />
              <Route path="/cashier/floor" element={<PageRoute page="floor-view"><FloorView /></PageRoute>} />
              <Route path="/floor/reservations" element={<PageRoute page="floor-reservations"><Reservations /></PageRoute>} />
              <Route path="/till/shift" element={<PageRoute page="till-shift"><ShiftPanel /></PageRoute>} />
              <Route path="/till/void-requests" element={<PageRoute page="till-void-requests"><VoidRequests /></PageRoute>} />
              <Route path="/till/tenders" element={<PageRoute page="till-tenders"><Tenders /></PageRoute>} />
              <Route path="/admin/till/shifts" element={<PageRoute page="till-shifts-admin"><ShiftsAdmin /></PageRoute>} />
              <Route path="/admin/till/void-reasons" element={<PageRoute page="till-void-reasons"><VoidReasons /></PageRoute>} />
              <Route path="/admin/currencies" element={<PageRoute page="currencies"><Currencies /></PageRoute>} />
              <Route path="/admin/till/displays" element={<PageRoute page="till-displays"><DisplaysAdmin /></PageRoute>} />
              <Route path="/delivery/board" element={<PageRoute page="delivery-board"><DeliveryBoard /></PageRoute>} />
              <Route path="/delivery/new" element={<PageRoute page="delivery-new"><NewDeliveryOrder /></PageRoute>} />
              <Route path="/admin/delivery/zones-drivers" element={<PageRoute page="delivery-zones"><ZonesDrivers /></PageRoute>} />
              <Route path="/admin/selforder/tables" element={<PageRoute page="selforder-tables"><SelfOrderTablesAdmin /></PageRoute>} />
              <Route path="/admin/kiosk/devices" element={<PageRoute page="kiosk-devices"><KioskDevicesAdmin /></PageRoute>} />
              <Route path="/accounting-plus/bank-reconciliation" element={<PageRoute page="acctplus-bank"><BankReconciliation /></PageRoute>} />
              <Route path="/accounting-plus/supplier-bills" element={<PageRoute page="acctplus-bills"><SupplierBills /></PageRoute>} />
              <Route path="/accounting-plus/aging" element={<PageRoute page="acctplus-aging"><Aging /></PageRoute>} />
              <Route path="/accounting-plus/vat-report" element={<PageRoute page="acctplus-vat"><VatReport /></PageRoute>} />
              <Route path="/accounting-plus/fixed-assets" element={<PageRoute page="acctplus-assets"><FixedAssets /></PageRoute>} />
              <Route path="/accounting-plus/periods" element={<PageRoute page="acctplus-periods"><Periods /></PageRoute>} />
              <Route path="/accounting/menu-engineering" element={<PageRoute page="menu-engineering"><MenuEngineering /></PageRoute>} />
              <Route path="/hr/employees" element={<PageRoute page="hr-employees"><HrEmployees /></PageRoute>} />
              <Route path="/hr/schedule" element={<PageRoute page="hr-schedule"><HrSchedule /></PageRoute>} />
              <Route path="/hr/attendance" element={<PageRoute page="hr-attendance"><HrAttendance /></PageRoute>} />
              <Route path="/hr/leave" element={<PageRoute page="hr-leave"><HrLeave /></PageRoute>} />
              <Route path="/hr/tips" element={<PageRoute page="hr-tips"><HrTipPools /></PageRoute>} />
              <Route path="/hr/clock" element={<PageRoute page="hr-clock"><HrClockKiosk /></PageRoute>} />
              <Route path="/hr/payroll" element={<PageRoute page="hr-payroll"><HrPayroll /></PageRoute>} />
              <Route path="/hr/pay-components" element={<PageRoute page="hr-pay-components"><HrPayComponents /></PageRoute>} />
              <Route path="/admin/marketing/segments" element={<PageRoute page="marketing-segments"><MarketingSegments /></PageRoute>} />
              <Route path="/admin/marketing/campaigns" element={<PageRoute page="marketing-campaigns"><MarketingCampaigns /></PageRoute>} />
              <Route path="/admin/promotions/gift-cards" element={<PageRoute page="promo-giftcards"><GiftCards /></PageRoute>} />
              <Route path="/admin/promotions/coupons" element={<PageRoute page="promo-coupons"><Coupons /></PageRoute>} />
              <Route path="/admin/promotions/happy-hours" element={<PageRoute page="promo-happyhours"><HappyHours /></PageRoute>} />
              <Route path="/admin/promotions/combos" element={<PageRoute page="promo-combos"><Combos /></PageRoute>} />
              <Route path="/admin/promotions/accounting" element={<PageRoute page="promo-accounting"><PromotionAccounting /></PageRoute>} />
              <Route path="/cashier/coupon" element={<PageRoute page="till-coupon-apply"><CouponApply /></PageRoute>} />
              <Route path="/admin/branches" element={<PageRoute page="branches"><Branches /></PageRoute>} />
              <Route path="/admin/branches/consolidated" element={<PageRoute page="branches-consolidated"><Consolidated /></PageRoute>} />
              <Route path="/admin/bi/reports" element={<PageRoute page="bi-scheduled-reports"><ScheduledReports /></PageRoute>} />
              <Route path="/owner" element={<PageRoute page="bi-owner-view"><OwnerView /></PageRoute>} />
              <Route path="/offline" element={<PageRoute page="offline-status"><OfflineStatus /></PageRoute>} />
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
