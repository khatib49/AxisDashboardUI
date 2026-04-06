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
