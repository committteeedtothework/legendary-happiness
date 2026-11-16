FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html LICENSE ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY server ./server
RUN npm run build:standalone

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 SOCIAL_DB=/data/friends.sqlite
VOLUME /data
WORKDIR /app
COPY --from=build /app/dist/DCSMCRAFT-Standalone.html ./dist/DCSMCRAFT-Standalone.html
COPY --from=build /app/node_modules/ws ./node_modules/ws
COPY server ./server
EXPOSE 8787
CMD ["node", "server/friends.mjs"]
