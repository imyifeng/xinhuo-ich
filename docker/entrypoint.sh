#!/bin/sh
# 生产容器入口：先应用数据库迁移，再启动 Nitro 服务
set -e

echo "[entrypoint] Applying database migrations..."
prisma migrate deploy

echo "[entrypoint] Starting server on ${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node .output/server/index.mjs
