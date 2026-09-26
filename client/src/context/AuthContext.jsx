import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Only a stored token needs checking against the server before routes render.
  const [loading, setLoading] = useState(() => !!localStorage.getItem("accessToken"));

  useEffect(() => {
    // An expired access token is refreshed by the api interceptor. Only a definitive 401
    // (the refresh failed too) ends the session; a network error or 5xx (e.g. the server
    // waking from sleep) is retried rather than logging the user out.
    const fetchUser = async (attempt = 0) => {
      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
        setLoading(false);
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setLoading(false);
        } else if (attempt < 3) {
          setTimeout(() => fetchUser(attempt + 1), 2000 * 2 ** attempt);
        } else {
          setLoading(false);
        }
      }
    };

    if (localStorage.getItem("accessToken")) fetchUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    if (response.data.requiresMfa) {
      return { requiresMfa: true, mfaChallengeToken: response.data.mfaChallengeToken };
    }
    const { user, accessToken, refreshToken } = response.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(user);
    return { user };
  };

  const completeMfa = async (mfaChallengeToken, code) => {
    const response = await api.post("/auth/mfa/challenge", { mfaChallengeToken, code });
    const { user, accessToken, refreshToken } = response.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(user);
    return user;
  };

  const register = async (name, email, password, orgName) => {
    const response = await api.post("/auth/register", {
      name,
      email,
      password,
      orgName,
    });
    const { user, accessToken, refreshToken } = response.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, completeMfa }}>
      {children}
    </AuthContext.Provider>
  );
};
