FROM node:14-alpine AS server
WORKDIR /app
COPY package.json yarn.lock mkprod.js ./
RUN yarn --frozen-lockfile
COPY tsconfig.json ./
COPY src src
RUN yarn build
RUN node mkprod.js
RUN yarn --frozen-lockfile

# FROM astefanutti/scratch-node:14
# WORKDIR /app
# COPY --from=server /app/node_modules node_modules
# COPY lib lib
COPY --from=patarapolw/rep2recall--web /app/dist public
ENTRYPOINT ["node", "lib/index.js"]
