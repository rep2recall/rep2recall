FROM node:12-alpine AS frontend
WORKDIR /app
COPY packages/web-frontend/package.json packages/web-frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY packages/web-frontend .
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN yarn build

FROM node:12-alpine AS server
WORKDIR /app
COPY packages/web-server/package.json packages/web-server/yarn.lock ./
RUN yarn
COPY packages/web-server .
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline --frozen-lockfile
COPY --from=frontend /app/dist public
EXPOSE 8080
ENTRYPOINT [ "node", "dist/index.js" ]
