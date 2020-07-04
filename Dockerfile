FROM node:12-alpine AS frontend
WORKDIR /app
COPY packages/web-frontend/package.json packages/web-frontend/yarn.lock ./
RUN yarn --frozen-lockfile
COPY packages/web-frontend .
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN yarn build

FROM node:12-alpine AS server
WORKDIR /app
COPY packages/web-server/package.json packages/web-server/yarn.lock ./
RUN yarn --frozen-lockfile
COPY packages/web-server .
RUN yarn build
RUN yarn --production --frozen-lockfile

FROM astefanutti/scratch-node:12
WORKDIR /app
COPY --from=server /app/node_modules /app/dist ./
COPY --from=frontend /app/dist public
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
