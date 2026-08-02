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

// The server's 404 catchall (server/src/app.js) returns exactly
// {"error":"Not found"} for any unmounted path. If we see that shape it means
// the request landed on the fallback — almost always because VITE_API_URL is
// misconfigured (e.g. missing /api suffix) or the client is calling a route
// the server doesn't mount. Rewrite the message so the UI stops surfacing a
// bare "Not found" that reads like a wrong password.
const CATCHALL_MESSAGE =
  "Cannot reach the server — check your connection or try again.";

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
      !originalRequest.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
