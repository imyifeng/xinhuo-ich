import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import {
  attachTags,
  createCourse,
  createCraftItem,
  createSessionCookie,
  createStep,
  createUser,
  disconnectFixtureRedis,
  resetCraftItemTables,
} from './helpers'

// 接缝 1：画像与推荐竖切（工单 #8）——
// 通过 HTTP 触发离线重建（与每日 cron 共用同一管道入口），
// 断言"请求进 → 响应出 + 数据库状态变"：learner_profile / recommendation 落库正确、
// 推荐不含本人已浏览条目、冷启动兜底非空、权限（非管理员 403 / 游客 401）。
// 行为事件由夹具直插（事件记录本身已在 craft-items.events 等用例覆盖）。

interface RebuildResponse {
  learnerCount: number
  profileCount: number
  chosenK: number | null
  clusters: Array<{ clusterIndex: number, label: string, size: number }>
  recommendationCount: number
  skippedClustering: boolean
}

interface FeedResponse {
  clusterLabel: string | null
  entries: Array<{
    type: 'CRAFT_ITEM' | 'COURSE'
    craftItemId: string | null
    courseId: string | null
    title: string
    reason: string
    score: number
  }>
}

describe('画像与推荐竖切', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let adminCookie: string
  let fanCookie: string
  let coldCookie: string
  let viewedItemIds: string[]
  const ceramicFanCount = 3
  const embroideryFanCount = 3

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)

    // ---- 内容夹具：两个子类别、四个条目，标签区分题材 ----
    const ceramic1 = await createCraftItem(prisma, { name: '推荐测试-青花瓷', subcategory: '陶瓷' })
    const ceramic2 = await createCraftItem(prisma, { name: '推荐测试-紫砂壶', subcategory: '陶瓷' })
    const embroidery1 = await createCraftItem(prisma, { name: '推荐测试-苏绣', subcategory: '织绣' })
    const embroidery2 = await createCraftItem(prisma, { name: '推荐测试-湘绣', subcategory: '织绣' })
    await attachTags(prisma, ceramic1.id, ['瓷器', '青花'])
    await attachTags(prisma, ceramic2.id, ['紫砂', '茶壶'])
    await attachTags(prisma, embroidery1.id, ['刺绣', '丝线'])
    await attachTags(prisma, embroidery2.id, ['刺绣', '丝线'])
    viewedItemIds = [ceramic1.id, ceramic2.id]

    // ---- 学习者夹具：3 名陶瓷爱好者 + 3 名织绣爱好者 + 1 名零行为（冷启动） ----
    const admin = await createUser(prisma, 'rec_admin', 'ADMIN')
    const fans = await Promise.all([
      ...Array.from({ length: ceramicFanCount }, (_, i) => createUser(prisma, `rec_ceramic_${i}`)),
      ...Array.from({ length: embroideryFanCount }, (_, i) => createUser(prisma, `rec_embroidery_${i}`)),
    ])
    const coldUser = await createUser(prisma, 'rec_cold')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    fanCookie = await createSessionCookie(fans[0]!.id)
    coldCookie = await createSessionCookie(coldUser.id)

    const events: Array<{ userId: number, type: 'VIEW_ITEM' | 'START_COURSE' | 'COMPLETE_STEP', targetType: string, targetId: string }> = []
    for (const fan of fans.slice(0, ceramicFanCount)) {
      for (let i = 0; i < 3; i++) events.push({ userId: fan.id, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: ceramic1.id })
      events.push({ userId: fan.id, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: ceramic2.id })
    }
    for (const fan of fans.slice(ceramicFanCount)) {
      for (let i = 0; i < 2; i++) events.push({ userId: fan.id, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: embroidery1.id })
    }
    await prisma.behaviorEvent.createMany({ data: events })

    // ---- 课程夹具：陶瓷爱好者开始并完成课程步骤（完成度维度） ----
    const course = await createCourse(prisma, { craftItemId: ceramic1.id, authorId: admin.id, status: 'PUBLISHED' })
    await createStep(prisma, course.id, 1)
    await createStep(prisma, course.id, 2)
    await prisma.behaviorEvent.createMany({ data: [
      { userId: fans[0]!.id, type: 'START_COURSE', targetType: 'COURSE', targetId: course.id },
      { userId: fans[0]!.id, type: 'COMPLETE_STEP', targetType: 'COURSE', targetId: course.id },
    ] })
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('非管理员触发重建返回 403，未登录也 403', async () => {
    const learnerRes = await apiFetch('/api/admin/profiles/rebuild', { method: 'POST', headers: { cookie: fanCookie } })
    expect(learnerRes.status).toBe(403)
    const guestRes = await apiFetch('/api/admin/profiles/rebuild', { method: 'POST' })
    expect(guestRes.status).toBe(403)
  })

  it('管理员触发重建：返回各簇人数、k 与计数，learner_profile 落库且簇分布合计=画像数', async () => {
    const body = await $fetch<RebuildResponse>('/api/admin/profiles/rebuild', {
      method: 'POST',
      headers: { cookie: adminCookie },
    })

    expect(body.skippedClustering).toBe(false)
    expect(body.learnerCount).toBe(ceramicFanCount + embroideryFanCount) // 冷启动学习者无行为，不参与
    expect(body.chosenK).toBeGreaterThanOrEqual(2)
    expect(body.clusters.length).toBe(body.chosenK)
    expect(body.profileCount).toBe(body.learnerCount)
    expect(body.clusters.reduce((sum, cluster) => sum + cluster.size, 0)).toBe(body.profileCount)
    expect(body.recommendationCount).toBeGreaterThan(0)
    for (const cluster of body.clusters) {
      expect(cluster.size).toBeGreaterThan(0)
      expect(cluster.label).not.toBe('')
    }

    const profiles = await prisma.learnerProfile.findMany()
    expect(profiles).toHaveLength(body.profileCount)
    for (const profile of profiles) {
      expect(profile.clusterLabel).not.toBe('')
      const vector = profile.featureVector as { dimensions: string[], values: number[] }
      expect(vector.dimensions.length).toBe(vector.values.length)
      expect(vector.values.every(value => Number.isFinite(value))).toBe(true)
    }
  })

  it('画像统计：管理员可读各簇人数分布，特征均值逐维可解释', async () => {
    const body = await $fetch<{ totalProfiles: number, clusters: Array<{ clusterIndex: number, label: string, size: number, featureMeans: Array<{ dimension: string, value: number }> }> }>(
      '/api/admin/profiles/stats',
      { headers: { cookie: adminCookie } },
    )
    expect(body.totalProfiles).toBe(6)
    expect(body.clusters.reduce((sum, cluster) => sum + cluster.size, 0)).toBe(body.totalProfiles)
    const anyCluster = body.clusters[0]!
    expect(anyCluster.featureMeans.length).toBeGreaterThan(2)
    expect(anyCluster.featureMeans[0]!.dimension).toMatch(/^浏览占比:/)
  })

  it('有画像学习者：推荐非空、不含本人已浏览条目、reason 为非空汉字', async () => {
    const body = await $fetch<FeedResponse>('/api/recommendations', { headers: { cookie: fanCookie } })
    expect(body.clusterLabel).not.toBeNull()
    expect(body.entries.length).toBeGreaterThan(0)
    for (const entry of body.entries) {
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(entry.score).toBeGreaterThanOrEqual(0)
      expect(entry.score).toBeLessThanOrEqual(1)
      if (entry.craftItemId) expect(viewedItemIds).not.toContain(entry.craftItemId)
    }
  })

  it('冷启动学习者（无行为事件）：画像为空但推荐兜底非空', async () => {
    const body = await $fetch<FeedResponse>('/api/recommendations', { headers: { cookie: coldCookie } })
    expect(body.clusterLabel).toBeNull()
    expect(body.entries.length).toBeGreaterThan(0)
    expect(body.entries.every(entry => entry.reason.length > 0)).toBe(true)
  })

  it('游客取推荐返回 401', async () => {
    const res = await apiFetch('/api/recommendations')
    expect(res.status).toBe(401)
  })
})
