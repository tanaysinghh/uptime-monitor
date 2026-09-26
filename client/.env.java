# Loaded by `npm run dev:java` (vite --mode java) when running against the Spring Boot
# backend in server-java/. REST calls go through the Vite /api proxy (port 5000) and
# real-time events use STOMP over WebSocket at /ws on the same port (proxied too).
VITE_REALTIME_TRANSPORT=stomp
