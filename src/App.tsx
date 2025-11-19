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

              {/* Admin F&B routes */}
              <Route path="/admin-fnb/dashboard" element={<AdminFnBRoute><AdminFnBDashboard /></AdminFnBRoute>} />
              <Route path="/admin-fnb/items" element={<AdminFnBRoute><AdminFnBItems /></AdminFnBRoute>} />
              <Route path="/admin-fnb/orders" element={<AdminFnBRoute><AdminFnBOrders /></AdminFnBRoute>} />

              {/* GameCashie routes (non-admin paths) */}
              <Route path="/game/sessions" element={<GameCashieRoute><GameSession /></GameCashieRoute>} />
              <Route path="/gamecashier/rooms" element={<GameCashieRoute><GameCashierRooms /></GameCashieRoute>} />
              {/* Make Cashier Items also available to game cashier roles */}
              <Route path="/gamecashier/items" element={<GameCashieRoute><CashierItems /></GameCashieRoute>} />
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
