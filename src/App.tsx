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
import Menu from "./pages/Menu";
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
import LoyaltyLeaderboard from './pages/Admin/LoyaltyLeaderboard';
import LoyaltyDraws from './pages/Admin/LoyaltyDraws';
import OpenInvoices from './pages/Cashier/OpenInvoices';
import AccountingDashboard from './pages/Accounting/AccountingDashboard';
import ChartOfAccounts from './components/Accounting/ChartOfAccounts';
import JournalEntryList from './components/Accounting/JournalEntryList';
import TrialBalance from './components/Accounting/TrialBalance';
import GeneralLedger from './components/Accounting/GeneralLedger';
import KitchenDisplay from "./pages/Chef/KitchenDisplay";
import BarDisplay from "./pages/bartender/BarDisplay";
import { TransactionAuditLogsPage } from "./pages/Admin/TransactionAuditLogsPage";
import ItemRevenueReport from "./pages/Accounting/ItemRevenueReport";
// ── Gap-closing modules ──
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

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authenticated, loading } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasRole("admin")) return <Navigate to="/" replace />;
  return children;
};

const CashierRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasRole("cashier")) return <Navigate to="/" replace />;
  return children;
};

const GameCashieRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!(hasRole("GameCashier") || hasRole("gamecashier") || hasRole("game_cashier") || hasRole("cashiergame"))) return <Navigate to="/" replace />;
  return children;
};

const AdminFnBRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasRole("admin_fnb")) return <Navigate to="/" replace />;
  return children;
};

const ChefRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasRole("chef")) return <Navigate to="/" replace />;
  return children;
};


const BarTenderRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { hasRole, loading, authenticated } = useAuth();
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasRole("bartender")) return <Navigate to="/bartender/bar-display" replace />;
  return children;
};

export default function App() {
  // Role-based home element: redirect non-admin operational roles away from dashboard
  const RoleHome: React.FC = () => {
    const { hasRole } = useAuth();
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

    if (hasRole("bartender")) {
      return <Navigate to="/bartender/bar-display" replace />;
    }

    return <Home />;
  };
  return (
    <>
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            {/* Public Menu Page - Standalone without layout */}
            <Route path="/menu" element={<Menu />} />
            {/* Public guest pages (no layout): reservation request, QR self-order, kiosk */}
            <Route path="/reserve" element={<ReservationRequest />} />
            <Route path="/order/:tableCode" element={<SelfOrderPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/display" element={<CustomerDisplayPage />} />

            {/* Dashboard Layout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index path="/" element={<RoleHome />} />

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
              <Route path="/admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
              <Route path="/admin/audit-logs" element={<AdminRoute><TransactionAuditLogsPage /></AdminRoute>} />
              <Route path="/admin/items" element={<AdminRoute><Items /></AdminRoute>} />
              <Route path="/admin/orders" element={<AdminRoute><Orders /></AdminRoute>} />
              <Route path="/cashier/items" element={<CashierRoute><CashierItems /></CashierRoute>} />
              <Route path="/cashier/orders" element={<CashierRoute><CashierOrders /></CashierRoute>} />
              <Route path="/admin/cards" element={<AdminRoute><Cards /></AdminRoute>} />
              <Route path="/admin/card-types" element={<AdminRoute><CardTypes /></AdminRoute>} />
              <Route path="/admin/game" element={<AdminRoute><Game /></AdminRoute>} />
              <Route path="/admin/game-settings" element={<AdminRoute><GameSettings /></AdminRoute>} />
              <Route path="/admin/game-sessions" element={<AdminRoute><GameSessions /></AdminRoute>} />
              <Route path="/admin/transactions" element={<AdminRoute><Transactions /></AdminRoute>} />
              <Route path="/admin/game-transactions" element={<AdminRoute><GameTransactions /></AdminRoute>} />
              <Route path="/admin/rooms" element={<AdminRoute><Rooms /></AdminRoute>} />
              <Route path="/admin/categories" element={<AdminRoute><CategoryManagement /></AdminRoute>} />
              <Route path="/admin/qr-generator" element={<AdminRoute><QRCodeGenerator /></AdminRoute>} />
              <Route path="/admin/discounts" element={<AdminRoute><DiscountManagement /></AdminRoute>} />
              <Route path="/admin/expenses" element={<AdminRoute><Expenses /></AdminRoute>} />
              <Route path="/admin/expense-categories" element={<AdminRoute><ExpenseCategories /></AdminRoute>} />
              <Route path="/admin/loyalty/customers" element={<ProtectedRoute><LoyaltyCustomers /></ProtectedRoute>} />
              <Route path="/admin/loyalty/leaderboard" element={<ProtectedRoute><LoyaltyLeaderboard /></ProtectedRoute>} />
              <Route path="/admin/loyalty/draws" element={<ProtectedRoute><LoyaltyDraws /></ProtectedRoute>} />

              {/* Admin Profit routes */}
              <Route path="/admin/profit/gaming" element={<AdminRoute><GamingProfit /></AdminRoute>} />
              <Route path="/admin/profit/tcg" element={<AdminRoute><TcgProfit /></AdminRoute>} />
              <Route path="/admin/profit/fnb" element={<AdminRoute><FnbProfit /></AdminRoute>} />
              <Route path="/admin/profit/overall" element={<AdminRoute><OverallProfit /></AdminRoute>} />

              {/* Admin F&B routes */}
              <Route path="/admin-fnb/dashboard" element={<AdminFnBRoute><AdminFnBDashboard /></AdminFnBRoute>} />
              <Route path="/admin-fnb/profit" element={<AdminFnBRoute><FnbProfit /></AdminFnBRoute>} />
              <Route path="/admin-fnb/items" element={<AdminFnBRoute><AdminFnBItems /></AdminFnBRoute>} />
              <Route path="/admin-fnb/orders" element={<AdminFnBRoute><AdminFnBOrders /></AdminFnBRoute>} />

              {/* Chef routes */}
              {/* <Route path="/chef/orders" element={<ChefRoute><KitchenOrders /></ChefRoute>} /> */}
              <Route path="/chef/stats" element={<ChefRoute><KitchenStats /></ChefRoute>} />
              <Route path="/chef/kitchen-display" element={<ChefRoute><KitchenDisplay /></ChefRoute>} />

              {/* Accounting routes */}
              <Route path="/accounting" element={<AdminRoute><AccountingDashboard /></AdminRoute>} />
              <Route path="/accounting/item-revenue" element={<AdminRoute><ItemRevenueReport /></AdminRoute>} />
              <Route path="/accounting/accounts" element={<AdminRoute><ChartOfAccounts /></AdminRoute>} />
              <Route path="/accounting/journal" element={<AdminRoute><JournalEntryList accountTypes={[]} accounts={[]} onSuccess={function (): void {
                throw new Error("Function not implemented.");
              } } onCancel={function (): void {
                throw new Error("Function not implemented.");
              } } /></AdminRoute>} />
              <Route path="/accounting/trial-balance" element={<AdminRoute><TrialBalance /></AdminRoute>} />
              <Route path="/accounting/general-ledger" element={<AdminRoute><GeneralLedger /></AdminRoute>} />

              {/* BarTender routes */}
              <Route path="/bartender/bar-display" element={<BarTenderRoute><BarDisplay /></BarTenderRoute>} />


              {/* GameCashie routes (non-admin paths) */}
              <Route path="/game/sessions" element={<GameCashieRoute><GameSession /></GameCashieRoute>} />
              <Route path="/gamecashier/rooms" element={<GameCashieRoute><GameCashierRooms /></GameCashieRoute>} />
              <Route path="/gamecashier/ps5-sessions" element={<GameCashieRoute><Ps5Sessions /></GameCashieRoute>} />
              <Route path="/gamecashier/board-sessions" element={<GameCashieRoute><BoardGameSessions /></GameCashieRoute>} />
              <Route path="/cashier/loyalty-check" element={<ProtectedRoute>
     <LoyaltyCheck />
        </ProtectedRoute>
    } 
/>
              
            <Route path="/cashier/open-invoices" element={<ProtectedRoute><OpenInvoices /></ProtectedRoute>} />
            
              {/* Make Cashier Items also available to game cashier roles */}
              <Route path="/gamecashier/items" element={<GameCashieRoute><CashierItems /></GameCashieRoute>} />
              <Route path="/gamecashier/clients" element={<GameCashieRoute><ClientManagement /></GameCashieRoute>} />

              {/* ── Stock operations (API enforces admin/stock/chef/admin_fnb) ── */}
              <Route path="/stock/locations" element={<ProtectedRoute><StockLocations /></ProtectedRoute>} />
              <Route path="/stock/counts" element={<ProtectedRoute><StockCounts /></ProtectedRoute>} />
              <Route path="/stock/transfers" element={<ProtectedRoute><StockTransfers /></ProtectedRoute>} />
              <Route path="/stock/reorder" element={<ProtectedRoute><ReorderSuggestions /></ProtectedRoute>} />
              <Route path="/stock/batches" element={<ProtectedRoute><StockBatches /></ProtectedRoute>} />

              {/* ── Floor, tables & reservations ── */}
              <Route path="/admin/floor-plan" element={<AdminRoute><FloorPlanAdmin /></AdminRoute>} />
              <Route path="/cashier/floor" element={<ProtectedRoute><FloorView /></ProtectedRoute>} />
              <Route path="/floor/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />

              {/* ── Till controls & currency ── */}
              <Route path="/till/shift" element={<ProtectedRoute><ShiftPanel /></ProtectedRoute>} />
              <Route path="/till/void-requests" element={<ProtectedRoute><VoidRequests /></ProtectedRoute>} />
              <Route path="/till/tenders" element={<ProtectedRoute><Tenders /></ProtectedRoute>} />
              <Route path="/admin/till/shifts" element={<AdminRoute><ShiftsAdmin /></AdminRoute>} />
              <Route path="/admin/till/void-reasons" element={<AdminRoute><VoidReasons /></AdminRoute>} />
              <Route path="/admin/currencies" element={<AdminRoute><Currencies /></AdminRoute>} />
              <Route path="/admin/till/displays" element={<AdminRoute><DisplaysAdmin /></AdminRoute>} />

              {/* ── Delivery, self-order & kiosk admin ── */}
              <Route path="/delivery/board" element={<ProtectedRoute><DeliveryBoard /></ProtectedRoute>} />
              <Route path="/delivery/new" element={<ProtectedRoute><NewDeliveryOrder /></ProtectedRoute>} />
              <Route path="/admin/delivery/zones-drivers" element={<AdminRoute><ZonesDrivers /></AdminRoute>} />
              <Route path="/admin/selforder/tables" element={<AdminRoute><SelfOrderTablesAdmin /></AdminRoute>} />
              <Route path="/admin/kiosk/devices" element={<AdminRoute><KioskDevicesAdmin /></AdminRoute>} />

              {/* ── Accounting depth ── */}
              <Route path="/accounting-plus/bank-reconciliation" element={<AdminRoute><BankReconciliation /></AdminRoute>} />
              <Route path="/accounting-plus/supplier-bills" element={<AdminRoute><SupplierBills /></AdminRoute>} />
              <Route path="/accounting-plus/aging" element={<AdminRoute><Aging /></AdminRoute>} />
              <Route path="/accounting-plus/vat-report" element={<AdminRoute><VatReport /></AdminRoute>} />
              <Route path="/accounting-plus/fixed-assets" element={<AdminRoute><FixedAssets /></AdminRoute>} />
              <Route path="/accounting-plus/periods" element={<AdminRoute><Periods /></AdminRoute>} />
              <Route path="/accounting/menu-engineering" element={<ProtectedRoute><MenuEngineering /></ProtectedRoute>} />

              {/* ── HR ── */}
              <Route path="/hr/employees" element={<AdminRoute><HrEmployees /></AdminRoute>} />
              <Route path="/hr/schedule" element={<AdminRoute><HrSchedule /></AdminRoute>} />
              <Route path="/hr/attendance" element={<AdminRoute><HrAttendance /></AdminRoute>} />
              <Route path="/hr/leave" element={<AdminRoute><HrLeave /></AdminRoute>} />
              <Route path="/hr/tips" element={<ProtectedRoute><HrTipPools /></ProtectedRoute>} />
              <Route path="/hr/clock" element={<ProtectedRoute><HrClockKiosk /></ProtectedRoute>} />

              {/* ── Promotions ── */}
              <Route path="/admin/promotions/gift-cards" element={<AdminRoute><GiftCards /></AdminRoute>} />
              <Route path="/admin/promotions/coupons" element={<AdminRoute><Coupons /></AdminRoute>} />
              <Route path="/admin/promotions/happy-hours" element={<AdminRoute><HappyHours /></AdminRoute>} />
              <Route path="/admin/promotions/combos" element={<AdminRoute><Combos /></AdminRoute>} />
              <Route path="/cashier/coupon" element={<ProtectedRoute><CouponApply /></ProtectedRoute>} />

              {/* ── Branches, BI & owner view ── */}
              <Route path="/admin/branches" element={<AdminRoute><Branches /></AdminRoute>} />
              <Route path="/admin/branches/consolidated" element={<AdminRoute><Consolidated /></AdminRoute>} />
              <Route path="/admin/bi/reports" element={<AdminRoute><ScheduledReports /></AdminRoute>} />
              <Route path="/owner" element={<ProtectedRoute><OwnerView /></ProtectedRoute>} />

              {/* ── Offline queue status ── */}
              <Route path="/offline" element={<ProtectedRoute><OfflineStatus /></ProtectedRoute>} />
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
