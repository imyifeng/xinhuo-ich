import { execSync } from 'node:child_process'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'
import '../prisma/load-env'

// 测试专用数据库：默认 xinhuo_test（与开发库同实例），每次运行 vitest 前强制重置。
// 连接方式：TEST_DATABASE_URL（见 .env.example）；未设置时使用下方默认值。

const DEFAULT_TEST_URL = 'postgresql://xinhuo:xinhuo@localhost:5433/xinhuo_test'

export default async function () {
  const testUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL
  await ensureTestDatabase(testUrl)
  // 供被测应用（Nitro 测试服务）与后续 prisma db push 使用
  process.env.DATABASE_URL = testUrl
  execSync('pnpm exec prisma db push --force-reset', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  })
}

/// 测试库不存在时先创建（连接同实例的 postgres 管理库判断）
async function ensureTestDatabase(testUrl: string) {
  const dbName = new URL(testUrl).pathname.replace(/^\//, '')
  const adminUrl = new URL(testUrl)
  adminUrl.pathname = '/postgres'
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
  })
  try {
    const rows = await prisma.$queryRaw<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname = ${dbName}`
    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
      console.log(`[test-setup] 已创建测试数据库 ${dbName}`)
    }
  }
  finally {
    await prisma.$disconnect()
  }
}
