FROM node:12-alpine AS frontend
WORKDIR /app
COPY submodules/web-frontend/package.json submodules/web-frontend/yarn.lock ./
RUN yarn
COPY submodules/web-frontend .
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN yarn build

FROM node:12-alpine AS server
WORKDIR /app
COPY submodules/web-server/package.json submodules/web-server/yarn.lock ./
RUN yarn
COPY submodules/web-server .
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline
COPY --from=frontend /app/dist public
EXPOSE 8080
ENTRYPOINT [ "node", "dist/index.js" ]
