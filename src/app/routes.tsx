import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext";
import { Root } from "./components/Root";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { BookPickup } from "./components/BookPickup";
import { PickupHistory } from "./components/PickupHistory";
import { NotFound } from "./components/NotFound";
import { Home } from "./components/Home";
import { Profile } from "./components/Profile";
import { Notifications } from "./components/Notifications";
import { AdminDashboard } from "./components/AdminDashboard";
import { ResetPassword } from "./components/ResetPassword";
import { Contact } from "./components/Contact";
import { Subscriptions } from "./components/Subscriptions";

const ADMIN_EMAIL = "admin@admin.com";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#3a6b3f] border-t-transparent animate-spin" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#3a6b3f] border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.email === ADMIN_EMAIL || (profile as any)?.is_admin === true;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function UserRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#3a6b3f] border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.email === ADMIN_EMAIL || (profile as any)?.is_admin === true;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  { path: "/reset-password", Component: ResetPassword },
  { path: "/contact", Component: Contact },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "admin", element: <AdminRoute><AdminDashboard /></AdminRoute> },
      { path: "dashboard", element: <UserRoute><Dashboard /></UserRoute> },
      { path: "book-pickup", element: <UserRoute><BookPickup /></UserRoute> },
      { path: "subscriptions", element: <UserRoute><Subscriptions /></UserRoute> },
      { path: "history", element: <UserRoute><PickupHistory /></UserRoute> },
      { path: "profile", element: <UserRoute><Profile /></UserRoute> },
      { path: "notifications", element: <UserRoute><Notifications /></UserRoute> },
      { path: "*", Component: NotFound },
    ],
  },
]);