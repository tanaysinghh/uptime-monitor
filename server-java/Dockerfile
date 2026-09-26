# Build: dependencies resolve in their own layer so code changes don't refetch them.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -o package -DskipTests \
 && java -Djarmode=tools -jar target/uptime-monitor-server-1.0.0.jar extract --destination /build/app

# Runtime: Java 25 (the code targets 21) for its AOT cache (JEP 483/514/515). On a Render
# free instance (0.1 CPU, 512 MB) startup drops from ~165s to ~95s with the cache.
FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini curl \
 && addgroup -S app && adduser -S app -G app
COPY --from=build /build/app/lib ./lib
COPY --from=build /build/app/uptime-monitor-server-1.0.0.jar ./app.jar
# Supabase's root CA for DB_SSL_CA_FILE=certs/supabase-root-2021.crt
COPY --chown=app:app certs ./certs

# Heap pinned (the AOT cache's archived heap objects are sized to it), G1 (the Serial
# collector cannot load them), C1-only JIT to spend less of a fractional CPU compiling.
# The cache keeps only class data: cached machine code (adapters/stubs) is compiled for
# the build host's CPU and crashed with SIGILL on a Render runtime host with fewer CPU
# features, so code caching is off.
ENV JVM_OPTS="-Xmx300m -XX:+UseG1GC -XX:TieredStopAtLevel=1 -Xss512k -XX:+ExitOnOutOfMemoryError -XX:+UnlockDiagnosticVMOptions -XX:-AOTAdapterCaching -XX:-AOTStubCaching"

# Training run at build time: start the context without a database, record the AOT
# cache, exit. Values below exist only for this step.
RUN DB_HOST=localhost DB_PORT=5432 DB_NAME=x DB_USER=x DB_PASSWORD=x \
    JWT_SECRET=aot-training-only-secret-000000000000 JWT_REFRESH_SECRET=aot-training-only-refresh-00000000000 \
    JWT_EXPIRES_IN=15m JWT_REFRESH_EXPIRES_IN=7d CLIENT_URL=http://localhost \
    MFA_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    java $JVM_OPTS -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh \
      -Dspring.flyway.enabled=false -Dspring.jpa.hibernate.ddl-auto=none \
      -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
      -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
      -Dapp.scheduler.enabled=false -jar app.jar \
 && test -s app.aot

USER app
ENV NODE_ENV=production PORT=5000 TZ=UTC
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "exec java $JVM_OPTS -XX:AOTCache=app.aot -jar app.jar"]
