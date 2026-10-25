# syntax=docker/dockerfile:1
# 薪火生产镜像：多阶段构建（ADR 0002）。产物自包含（Nitro .output），
# 运行时仅含 .output + 全局 Prisma CLI（用于启动时 migrate deploy）+ schema/migrations。
ARG NODE_VERSION=26.12.1-alpine

# ---- 阶段 1：依赖安装（含 devDependencies，构建期使用）----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json ./
# Node 26 镜像不再内置 corepack，改为安装 package.json 指定的 pnpm 版本（busybox sh 不支持嵌套引号，故分两步）
RUN node -p "require('./package.json').packageManager.split('@')[1]" > /tmp/pnpm-version
RUN npm install --global "pnpm@$(cat /tmp/pnpm-version)"
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
# postinstall 里的 prisma generate 需要 schema
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN pnpm install --frozen-lockfile

# ---- 阶段 2：构建（prisma generate + nuxt build）----
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=deps /usr/local/bin/ /usr/local/bin/
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# ---- 阶段 3：运行时 ----
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
# 版本从 package.json 读取，避免两处维护（分两步以兼容 busybox sh）
COPY package.json ./
RUN node -p "require('./package.json').dependencies.prisma" > /tmp/prisma-version
RUN npm install --global "prisma@$(cat /tmp/prisma-version)" \
  && npm cache clean --force
COPY --from=build /app/.output ./.output
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY prisma.config.ts docker/entrypoint.sh ./
RUN chmod +x entrypoint.sh
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
