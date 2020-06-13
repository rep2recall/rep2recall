FROM node:12-alpine AS frontend
RUN apk add git
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock /app/
RUN yarn
COPY frontend /app
ARG FIREBASE_CONFIG
ARG BASE_URL
RUN yarn build

FROM node:12-alpine AS server
WORKDIR /app
COPY server/package.json server/yarn.lock /app/
RUN yarn
COPY server /app
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline

FROM astefanutti/scratch-node:12
WORKDIR /app
COPY --from=server /app/node_modules /app/dist /app/
COPY --from=frontend /app/dist /app/public
EXPOSE 8080
ENTRYPOINT [ "node", "dist/index.js" ]
