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

/** 清空条目相关表（级联含传承人/条目标签）与课程相关表 */
export async function resetCraftItemTables(prisma: PrismaClient) {
  await resetCourseTables(prisma)
  await resetProfileTables(prisma)
  await prisma.behaviorEvent.deleteMany()
  await prisma.user.deleteMany()
  await prisma.craftItemTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.inheritor.deleteMany()
  await prisma.craftItem.deleteMany()
}

/** 清空画像与推荐表（工单 #8）：须在清用户表之前调用以解除引用 */
export async function resetProfileTables(prisma: PrismaClient) {
  await prisma.recommendation.deleteMany()
  await prisma.learnerProfile.deleteMany()
}

/** 清空课程相关表（学习记录/步骤/课程） */
export async function resetCourseTables(prisma: PrismaClient) {
  await prisma.learningRecord.deleteMany()
  await prisma.step.deleteMany()
  await prisma.course.deleteMany()
}

/** 课程夹具：craftItemId 与 authorId 必须由调用方先备好（条目与用户） */
export async function createCourse(
  prisma: PrismaClient,
  overrides: Partial<{
    title: string
    intro: string
    craftItemId: string
    authorId: number
    status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
    rejectReason: string | null
  }> = {},
) {
  return prisma.course.create({
    data: {
      title: overrides.title ?? `测试课程-${Math.random().toString(36).slice(2)}`,
      intro: overrides.intro ?? '课程简介',
      craftItemId: overrides.craftItemId!,
      authorId: overrides.authorId!,
      status: overrides.status ?? 'DRAFT',
      rejectReason: overrides.rejectReason ?? null,
    },
  })
}

// ---- 交流区夹具（工单 #7）----

/** 帖子夹具：默认可见，暴露测试关心的覆盖项 */
export async function createPost(
  prisma: PrismaClient,
  authorId: number,
  overrides: Partial<{ title: string, content: string, status: 'VISIBLE' | 'HIDDEN', createdAt: Date }> = {},
) {
  return prisma.post.create({
    data: {
      authorId,
      title: overrides.title ?? `测试帖子-${Math.random().toString(36).slice(2)}`,
      content: overrides.content ?? '测试正文',
      status: overrides.status ?? 'VISIBLE',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  })
}

/** 步骤夹具：默认内容足够通过校验 */
export async function createStep(
  prisma: PrismaClient,
  courseId: string,
  order: number,
  overrides: Partial<{ title: string, content: string, imageUrl: string | null }> = {},
) {
  return prisma.step.create({
    data: {
      courseId,
      order,
      title: overrides.title ?? `第 ${order} 步`,
      content: overrides.content ?? `第 ${order} 步的内容`,
      imageUrl: overrides.imageUrl ?? null,
    },
  })
}

/** 评论夹具：默认可见 */
export async function createComment(
  prisma: PrismaClient,
  postId: string,
  authorId: number,
  overrides: Partial<{ content: string, status: 'VISIBLE' | 'HIDDEN', createdAt: Date }> = {},
) {
  return prisma.comment.create({
    data: {
      postId,
      authorId,
      content: overrides.content ?? '测试评论',
      status: overrides.status ?? 'VISIBLE',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  })
}

/** 清空交流区相关表（评论级联于帖子；事件一并清空；用户保留以免夹具会话失效） */
export async function resetPostTables(prisma: PrismaClient) {
  await prisma.behaviorEvent.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.post.deleteMany()
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
