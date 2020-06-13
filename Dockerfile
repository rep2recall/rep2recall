FROM node:12-alpine AS frontend
RUN apk add git
WORKDIR /app
COPY submodules/frontend/package.json submodules/frontend/yarn.lock ./
RUN yarn
COPY submodules/frontend .
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN yarn build

FROM node:12-alpine AS server
WORKDIR /app
COPY submodules/server/package.json submodules/server/yarn.lock ./
RUN yarn
COPY submodules/server .
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline
COPY --from=frontend /app/dist public
EXPOSE 8080
ENTRYPOINT [ "node", "dist/index.js" ]
