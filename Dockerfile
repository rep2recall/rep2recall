FROM node:10-alpine AS ui
RUN mkdir -p /ui
WORKDIR /ui
COPY packages/ui/package.json /ui
RUN npm i
COPY packages/ui /ui
ARG VUE_APP_FIREBASE_CONFIG
RUN npm run build

FROM node:10-alpine
RUN mkdir -p /server
WORKDIR /server
COPY packages/server/package.json /server
RUN npm i
COPY packages/server /server
RUN npm run build
RUN npm prune
COPY --from=ui /ui/dist /server/public
EXPOSE 8080
CMD [ "npm", "start" ]