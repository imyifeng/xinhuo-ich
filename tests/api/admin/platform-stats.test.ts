import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端平台统计（规格 #1 用户故事 26）——
// /api/admin/profiles/stats 在既有画像簇分布之外合并输出用户总数（按角色分）与
// 学习行为总量（behavior_event 按类型计数）；未登录/非管理员一律 403。
describe('管理端平台统计 GET /api/admin/profiles/stats（用户故事 26）', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let adminCookie: string
  let learnerCookie: string

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'platform_admin', 'ADMIN')
    const learner1 = await createUser(prisma, 'platform_learner_1')
    const learner2 = await createUser(prisma, 'platform_learner_2')
    await createUser(prisma, 'platform_inheritor', 'INHERITOR')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    learnerCookie = await createSessionCookie(learner1.id)

    // 行为夹具：五类事件中四类有量，评论为 0（验证零值也如实输出）
    await prisma.behaviorEvent.createMany({
      data: [
        { userId: learner1.id, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: 'item-x' },
        { userId: learner2.id, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: 'item-y' },
        { userId: learner1.id, type: 'START_COURSE', targetType: 'COURSE', targetId: 'course-x' },
        { userId: learner1.id, type: 'COMPLETE_STEP', targetType: 'COURSE', targetId: 'course-x' },
        { userId: learner2.id, type: 'CREATE_POST', targetType: 'POST', targetId: 'post-x' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录与学习者访问均 403', async () => {
    expect((await apiFetch('/api/admin/profiles/stats')).status).toBe(403)
    expect((await apiFetch('/api/admin/profiles/stats', { headers: { cookie: learnerCookie } })).status).toBe(403)
  })

  it('管理员读取平台统计：用户按角色计数、行为按类型计数，簇分布合并输出且与夹具吻合', async () => {
    const res = await apiFetch('/api/admin/profiles/stats', { headers: { cookie: adminCookie } })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.users).toEqual({
      total: 4,
      byRole: { LEARNER: 2, INHERITOR: 1, ADMIN: 1 },
    })
    expect(body.behavior).toEqual({
      total: 5,
      byType: { VIEW_ITEM: 2, START_COURSE: 1, COMPLETE_STEP: 1, CREATE_POST: 1, CREATE_COMMENT: 0 },
    })

    // 既有画像统计合并输出（未跑过管道时簇分布为空）
    expect(body.totalProfiles).toBe(0)
    expect(body.clusters).toEqual([])
  })
})
