FROM node:12-alpine AS server
RUN apk add jq
WORKDIR /app
COPY package.json yarn.lock ./
RUN jq 'del(.devDependencies)' package.json > tmp.json && mv tmp.json package.json
RUN yarn --frozen-lockfile

FROM astefanutti/scratch-node:12
WORKDIR /app
COPY --from=server /app/node_modules node_modules
COPY lib public ./
ENTRYPOINT ["node", "lib/index.js"]
