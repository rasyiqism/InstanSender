FROM oven/bun:1.4-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile || bun install --production

COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
