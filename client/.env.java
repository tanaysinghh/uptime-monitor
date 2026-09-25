# Loaded by `npm run dev:java` (vite --mode java) when running against the Spring Boot
# backend in server-java/. REST calls still go through the Vite /api proxy (port 5000);
# the Java backend serves Socket.IO on its own port (SOCKET_PORT, default 5001).
VITE_SOCKET_URL=http://localhost:5001
