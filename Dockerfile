FROM node:12-alpine AS ui
RUN mkdir -p /ui
WORKDIR /ui
COPY packages/ui/package.json /ui
RUN npm i
COPY packages/ui /ui
RUN npm run build

FROM node:12-alpine
RUN mkdir -p /server
WORKDIR /server
COPY --from=ui /ui/dist /server/public
COPY packages/server/package.json /server
RUN npm i
COPY packages/server /server
RUN npm run build
RUN npm prune
EXPOSE 8080
CMD [ "npm", "start" ]