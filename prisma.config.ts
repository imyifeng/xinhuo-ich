import type { PrismaConfig } from 'prisma/config'
import { existsSync, readFileSync } from 'node:fs'

// Prisma 7 CLI 不再自动加载 .env 文件，这里手动补上（不覆盖已存在的环境变量）。
// 注意：本文件会被 CLI 以单文件方式转译加载，无法 import 兄弟 TS 模块，
// 因此加载逻辑与 prisma/load-env.ts 是有意保持一致的两份副本（生产容器内没有 .env，此处为空操作）。
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

// datasource 仅在拿到 DATABASE_URL 时提供：prisma generate 等离线命令不需要数据库，
// 不应因为缺少连接串而失败；migrate / db push / seed 则要求该变量存在。
const datasource = process.env.DATABASE_URL
  ? { datasource: { url: process.env.DATABASE_URL } }
  : {}

// 刻意不用 defineConfig()（那会在运行时 import 'prisma/config'）：
// 生产镜像里只有全局安装的 Prisma CLI、schema 与本文件，没有项目 node_modules，
// 纯对象 + type-only import 才能被容器内的 CLI 加载。
export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...datasource,
} satisfies PrismaConfig
