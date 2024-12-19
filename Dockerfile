FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS devdeps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM devdeps AS build
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM deps AS deploy
COPY ./.env ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/backend ./src/backend
COPY --from=build /app/server.ts ./
COPY --from=build /app/package.json ./

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "server.ts", "prod" ]