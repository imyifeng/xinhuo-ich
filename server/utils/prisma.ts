import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

/**
 * 数据访问层：Prisma 客户端单例（进程内复用，开发热载时不随 HMR 重建）。
 * Prisma 7 通过 driver adapter（@prisma/adapter-pg）建立连接，连接串来自 DATABASE_URL。
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL 未设置：请复制 .env.example 为 .env 并按需修改')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { __xinhuoPrisma?: PrismaClient }

/** 获取全局唯一的 Prisma 客户端实例（Nitro 自动导入，server 内可直接调用） */
export function usePrisma(): PrismaClient {
  globalForPrisma.__xinhuoPrisma ??= createPrismaClient()
  return globalForPrisma.__xinhuoPrisma
}
