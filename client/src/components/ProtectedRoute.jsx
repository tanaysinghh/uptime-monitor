import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loading } from "./ui/States";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loading label="Loading" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
