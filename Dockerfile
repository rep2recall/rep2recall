FROM node:10-alpine AS web
RUN mkdir -p /web
WORKDIR /web
COPY packages/web/package.json packages/web/package-lock.json /web/
RUN npm i
COPY packages/web /web
ARG VUE_APP_FIREBASE_CONFIG
ARG VUE_APP_BASE_URL
RUN npm run build

FROM node:10-alpine
RUN mkdir -p /server
WORKDIR /server
COPY packages/server/package.json /server/
RUN npm i
COPY packages/server /server
RUN npm run build
RUN npm prune --production; exit 0
COPY --from=web /web/dist /server/public
EXPOSE 8080
CMD [ "npm", "start" ]