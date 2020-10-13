FROM node:12-alpine AS web
RUN npm i -g pnpm
WORKDIR /app
COPY packages/web/package.json packages/web/pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile
COPY packages/web .
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN pnpm build

FROM node:12-alpine AS server
RUN npm i -g pnpm
WORKDIR /app
COPY packages/server/package.json packages/server/pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile
COPY packages/server .
RUN pnpm build
RUN pnpm i --prod --frozen-lockfile

FROM astefanutti/scratch-node:12
WORKDIR /app
COPY --from=server /app/node_modules /app/dist ./
COPY --from=web /app/dist public
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
