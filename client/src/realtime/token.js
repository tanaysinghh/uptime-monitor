import { refreshAccessToken } from "../api/axios";

const EXPIRY_MARGIN_MS = 30_000;

const expiresSoon = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return !payload.exp || payload.exp * 1000 - Date.now() < EXPIRY_MARGIN_MS;
  } catch {
    return true;
  }
};

/**
 * An access token good for at least the next 30 seconds, for authenticating a
 * WebSocket connection. `force` refreshes regardless (the server refused the last one).
 * Returns null if there is no session.
 */
export const freshAccessToken = async ({ force = false } = {}) => {
  const token = localStorage.getItem("accessToken");
  if (token && !force && !expiresSoon(token)) return token;
  if (!localStorage.getItem("refreshToken")) return token;
  try {
    return await refreshAccessToken();
  } catch {
    return null; // refreshAccessToken has already sent the browser to /login
  }
};
