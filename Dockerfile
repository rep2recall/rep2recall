FROM node:12-alpine AS web
RUN mkdir -p /web
WORKDIR /web
COPY packages/web/package.json packages/web/yarn.lock /web/
RUN yarn
COPY packages/web /web
ARG VUE_APP_FIREBASE_CONFIG
ARG VUE_APP_BASE_URL
RUN yarn build

FROM node:12-alpine AS server
RUN mkdir -p /server
WORKDIR /server
COPY packages/server/package.json packages/server/yarn.lock /server/
RUN yarn
COPY packages/server /server
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline

FROM astefanutti/scratch-node:12
WORKDIR /app
COPY --from=server /server/node_modules /server/dist /app/
COPY --from=web /web/dist /app/public
EXPOSE 8080
ENTRYPOINT [ "node", "dist/index.js" ]