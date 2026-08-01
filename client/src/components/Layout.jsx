import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { Wordmark } from "./ui/Brand";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/monitors",  label: "Monitors",  icon: Activity },
  { path: "/alerts",    label: "Alerts",    icon: Bell },
  { path: "/team",      label: "Team",      icon: Users },
  { path: "/settings",  label: "Settings",  icon: SettingsIcon },
];

const SidebarLink = ({ item }) => (
  <NavLink
    to={item.path}
    className={({ isActive }) =>
      cn(
        "group relative flex items-center gap-3 pl-5 pr-4 h-10 text-sm transition-colors",
        isActive
          ? "text-ink bg-bone"
          : "text-muted hover:text-ink hover:bg-bone/50"
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-pulse"
          />
        )}
        <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.6} />
        <span>{item.label}</span>
      </>
    )}
  </NavLink>
);

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* ============ Desktop sidebar ============ */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 hairline-r bg-paper sticky top-0 h-screen">
        <div className="px-5 py-6 hairline-b">
          <Link to="/dashboard" className="inline-flex" aria-label="Uptime Monitor home">
            <Wordmark />
          </Link>
        </div>

        <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted px-5 pt-6 pb-2">
          Workspace
        </div>
        <nav className="flex-1 flex flex-col gap-0.5 px-0" aria-label="Primary">
          {nav.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>

        <div className="hairline-t px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center text-xs font-num tracking-wider">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink truncate">{user?.name}</p>
            <p className="text-[11px] text-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-muted hover:text-st-down transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      </aside>

      {/* ============ Mobile top bar ============ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-paper hairline-b flex items-center justify-between px-4 h-14">
        <Link to="/dashboard" aria-label="Home">
          <Wordmark />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-ink"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-ink/30"
            />
            <motion.aside
              initial={reduce ? {} : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? {} : { x: "-100%" }}
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-paper hairline-r flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 hairline-b">
                <Wordmark />
                <button onClick={() => setMobileOpen(false)} className="p-1 text-muted" aria-label="Close menu">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 flex flex-col gap-0.5 pt-3" onClick={() => setMobileOpen(false)}>
                {nav.map((item) => <SidebarLink key={item.path} item={item} />)}
              </nav>
              <div className="hairline-t px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center text-xs font-num">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{user?.name}</p>
                  <p className="text-[11px] text-muted truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="p-2 text-muted hover:text-st-down" aria-label="Sign out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ============ Main content ============ */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <motion.div
          key={typeof window !== "undefined" ? window.location.pathname : "page"}
          initial={reduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: [0.25, 1, 0.5, 1] }}
          className="px-6 md:px-10 py-8 md:py-10 max-w-[1400px] mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
