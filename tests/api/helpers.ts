import { randomBytes } from 'node:crypto'
import Redis from 'ioredis'
import type { PrismaClient } from '../../server/generated/prisma/client'

/** 测试夹具工厂：条目默认字段随 schema 演进，仅暴露测试关心的覆盖项 */
export async function createCraftItem(
  prisma: PrismaClient,
  overrides: Partial<{ name: string, subcategory: string, region: string, batch: string, code: string, history: string, features: string, images: unknown, videoUrl: string | null, status: 'DRAFT' | 'PUBLISHED' }> = {},
) {
  return prisma.craftItem.create({
    data: {
      name: overrides.name ?? `测试条目-${Math.random().toString(36).slice(2)}`,
      subcategory: overrides.subcategory ?? '陶瓷',
      region: overrides.region ?? '江西省',
      batch: overrides.batch ?? '第一批（2006 年）',
      code: overrides.code ?? 'Ⅷ-7',
      history: overrides.history ?? '历史渊源',
      features: overrides.features ?? '工艺特色',
      images: (overrides.images ?? []) as object,
      videoUrl: overrides.videoUrl ?? null,
      status: overrides.status ?? 'PUBLISHED',
    },
  })
}

/** 给条目挂标签（不存在则创建），返回标签名列表 */
export async function attachTags(prisma: PrismaClient, craftItemId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} })
    await prisma.craftItemTag.create({ data: { craftItemId, tagId: tag.id } })
  }
}

/** 清空条目相关表（级联含传承人/条目标签） */
export async function resetCraftItemTables(prisma: PrismaClient) {
  await prisma.behaviorEvent.deleteMany()
  await prisma.user.deleteMany()
  await prisma.craftItemTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.inheritor.deleteMany()
  await prisma.craftItem.deleteMany()
}

// ---- 会话夹具：与 server/utils/session.ts 的共享契约一致（勿改格式） ----

const SESSION_COOKIE = 'xinhuo_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

let redisFixture: Redis | null = null

function fixtureRedis(): Redis {
  redisFixture ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380/2', {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  })
  return redisFixture
}

/** 造用户夹具（密码哈希占位即可，T3 不测认证；displayName 为 T2 User 模型必填）。
 * T4 起支持指定角色（默认学习者），供管理端守卫/角色标记测试使用 */
export async function createUser(
  prisma: PrismaClient,
  username?: string,
  role: 'LEARNER' | 'INHERITOR' | 'ADMIN' = 'LEARNER',
) {
  return prisma.user.create({
    data: {
      username: username ?? `${role.toLowerCase()}-${Math.random().toString(36).slice(2)}`,
      displayName: role === 'ADMIN' ? '测试管理员' : '测试学习者',
      passwordHash: 'test-hash',
      role,
    },
  })
}

/** 按会话契约直接向 Redis 写 session:<token>，返回可直接放进请求头的 Cookie 值 */
export async function createSessionCookie(userId: number, role = 'LEARNER'): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const payload = { userId, role, createdAt: new Date().toISOString() }
  await fixtureRedis().set(`session:${token}`, JSON.stringify(payload), 'EX', SESSION_TTL_SECONDS)
  return `${SESSION_COOKIE}=${token}`
}

export async function disconnectFixtureRedis() {
  await redisFixture?.quit()
  redisFixture = null
}
