FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.10.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Route modules are loaded during the build, but no production database is used.
RUN DATABASE_URL=postgresql://build@127.0.0.1:1/build pnpm build

FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS runtime
WORKDIR /app
ARG APP_REVISION
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV APP_REVISION=$APP_REVISION
LABEL org.opencontainers.image.source="https://github.com/victoria-shaduro/personal-crm"
LABEL org.opencontainers.image.revision=$APP_REVISION
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app
# Keep the existing migration and seed tools in the same image as the app.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/src/db ./src/db
COPY --from=build --chown=app:app /app/deploy/migrate.mjs ./deploy/migrate.mjs
USER app
EXPOSE 3000
CMD ["node", "server.js"]
