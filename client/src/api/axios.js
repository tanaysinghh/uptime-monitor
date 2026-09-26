import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export { API_BASE_URL };

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// One refresh at a time: refresh tokens rotate, so two concurrent refreshes with the
// same token would race. Callers that arrive while one is in flight share its result.
let refreshInFlight = null;

/**
 * Exchanges the stored refresh token for a new pair and returns the new access token.
 * On failure the session is over: tokens are cleared and the browser goes to /login.
 */
export const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);
        return accessToken;
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw refreshError;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
};

// The server's 404 catchall (server/src/app.js) returns exactly
// {"error":"Not found"} for any unmounted path. If we see that shape it means
// the request landed on the fallback — almost always because VITE_API_URL is
// misconfigured (e.g. missing /api suffix) or the client is calling a route
// the server doesn't mount. Rewrite the message so the UI stops surfacing a
// bare "Not found" that reads like a wrong password.
const CATCHALL_MESSAGE =
  "Cannot reach the server — check your connection or try again.";

// 401s that mean "your access token is no good" (the auth middleware's messages), as
// opposed to a wrong password or MFA code on an /auth/* endpoint. Only these are worth
// a refresh and retry; retrying a wrong code would count as a second failed attempt.
const TOKEN_ERRORS = new Set([
  "No token provided",
  "Invalid token",
  "User not found",
  "Session revoked",
  "Token invalidated by password change",
]);
// Endpoints that authenticate with credentials rather than the access token.
const CREDENTIAL_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh-token", "/auth/mfa/challenge"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 404 &&
      error.response?.data?.error === "Not found"
    ) {
      error.response.data.error = CATCHALL_MESSAGE;
    }

    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      TOKEN_ERRORS.has(error.response?.data?.error) &&
      !CREDENTIAL_ENDPOINTS.some((path) => originalRequest.url?.includes(path))
    ) {
      originalRequest._retry = true;
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
