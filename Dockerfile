FROM node:10-alpine AS ui
RUN mkdir -p /ui
WORKDIR /ui
COPY packages/ui/package.json packages/ui/package-lock.json /ui/
RUN npm i
COPY packages/ui /ui
ARG VUE_APP_FIREBASE_CONFIG
ARG BASE_URL
RUN npm run build

FROM node:10-alpine
RUN mkdir -p /server
WORKDIR /server
COPY packages/server/package.json packages/server/package-lock.json /server/
RUN npm i
COPY packages/server /server
RUN npm run build
RUN npm prune
COPY --from=ui /ui/dist /server/public
EXPOSE 8080
CMD [ "npm", "start" ]