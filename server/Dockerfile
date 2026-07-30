FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tini curl \
  && addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package*.json ./
COPY --chown=app:app src ./src

USER app
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
