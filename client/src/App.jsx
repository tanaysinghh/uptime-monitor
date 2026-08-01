import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Monitors from "./pages/Monitors";
import MonitorDetail from "./pages/MonitorDetail";
import StatusPage from "./pages/StatusPage";
import Landing from "./pages/Landing";
import Alerts from "./pages/Alerts";
import Team from "./pages/Team";
import Settings from "./pages/Settings";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#133024",
              color: "#F2F4EF",
              border: "1px solid #1E4234",
              borderRadius: "0",
              fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
              fontSize: "13px",
              padding: "10px 14px",
            },
            success: { iconTheme: { primary: "#4FBF83", secondary: "#0B1F17" } },
            error:   { iconTheme: { primary: "#E86454", secondary: "#0B1F17" } },
          }}
        />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/status/:slug" element={<StatusPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/monitors" element={<ProtectedRoute><Layout><Monitors /></Layout></ProtectedRoute>} />
          <Route path="/monitors/:id" element={<ProtectedRoute><Layout><MonitorDetail /></Layout></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Layout><Alerts /></Layout></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><Layout><Team /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
