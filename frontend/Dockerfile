FROM oven/bun:1.4-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ARG VITE_APP_NAME=InstanSender
ARG VITE_API_BASE_URL=/api
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN bun run build

FROM nginx:1.29-alpine

ENV BACKEND_URL=http://backend:3000
ENV VITE_APP_NAME=InstanSender
ENV VITE_API_BASE_URL=/api
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY deploy/nginx.container.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/runtime-config.js.template /etc/app/runtime-config.js.template
COPY --chmod=755 deploy/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
