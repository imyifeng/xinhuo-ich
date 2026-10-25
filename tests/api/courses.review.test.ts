import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import {
  createCraftItem,
  createCourse,
  createSessionCookie,
  createUser,
  disconnectFixtureRedis,
  resetCraftItemTables,
} from './helpers'

// 接缝 1：课程审核流（工单 #6 用户故事 17、23）——
// 传承人提交（DRAFT/REJECTED → PENDING_REVIEW，至少一个步骤）；
// 管理员发布（→ PUBLISHED）与驳回（→ REJECTED，可带理由）；状态机外的迁移 409。
describe('课程提交与审核 /api/studio + /api/admin/courses', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let inheritorCookie: string
  let learnerCookie: string
  let adminCookie: string
  let item: Awaited<ReturnType<typeof createCraftItem>>

  const json = { 'content-type': 'application/json' }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    item = await createCraftItem(prisma, { name: '审核用条目' })
    const inheritor = await createUser(prisma, 'review_inheritor', 'INHERITOR')
    const learner = await createUser(prisma, 'review_learner')
    const admin = await createUser(prisma, 'review_admin', 'ADMIN')
    inheritorCookie = await createSessionCookie(inheritor.id, 'INHERITOR')
    learnerCookie = await createSessionCookie(learner.id)
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  /** 走 API 造一门带一个步骤的草稿课程，返回课程 ID */
  async function createDraftCourse(title: string): Promise<string> {
    const course = await $fetch<{ id: string }>('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: inheritorCookie, ...json },
      body: { title, intro: '简介', craftItemId: item.id },
    })
    await $fetch(`/api/studio/courses/${course.id}/steps`, {
      method: 'POST',
      headers: { cookie: inheritorCookie, ...json },
      body: { title: '第一步', content: '第一步内容' },
    })
    return course.id
  }

  it('提交审核：草稿 → 待审核', async () => {
    const courseId = await createDraftCourse('待审课程甲')
    const body = await $fetch<{ id: string, status: string }>(`/api/studio/courses/${courseId}/submit`, {
      method: 'POST',
      headers: { cookie: inheritorCookie },
    })
    expect(body.status).toBe('PENDING_REVIEW')
  })

  it('无步骤的草稿不能提交：400', async () => {
    const course = await $fetch<{ id: string }>('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: inheritorCookie, ...json },
      body: { title: '空壳课程', intro: '简介', craftItemId: item.id },
    })
    const res = await fetch(`/api/studio/courses/${course.id}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })
    expect(res.status).toBe(400)
  })

  it('重复提交（已是待审核）409', async () => {
    const courseId = await createDraftCourse('重复提交课程')
    await $fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })
    const res = await fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })
    expect(res.status).toBe(409)
  })

  it('管理员待审列表：默认返回待审核，含作者与条目信息', async () => {
    const body = await $fetch<{ items: Array<{ id: string, title: string, status: string, author: { displayName: string }, craftItemName: string, stepCount: number }> }>(
      '/api/admin/courses?status=PENDING_REVIEW',
      { headers: { cookie: adminCookie } },
    )
    const row = body.items.find(c => c.title === '待审课程甲')
    expect(row).toBeDefined()
    expect(row!.author.displayName).toBe('测试学习者')
    expect(row!.craftItemName).toBe('审核用条目')
    expect(row!.stepCount).toBe(1)
  })

  it('非管理员访问审核接口 403（未登录同样 403，沿用管理端契约）', async () => {
    const guest = await fetch('/api/admin/courses')
    expect(guest.status).toBe(403)
    const learner = await fetch('/api/admin/courses', { headers: { cookie: learnerCookie } })
    expect(learner.status).toBe(403)
    const publish = await fetch('/api/admin/courses/whatever/publish', { method: 'POST', headers: { cookie: learnerCookie } })
    expect(publish.status).toBe(403)
  })

  it('管理员发布：待审核 → 已发布', async () => {
    const courseId = await createDraftCourse('发布课程乙')
    await $fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })

    const body = await $fetch<{ id: string, status: string }>(`/api/admin/courses/${courseId}/publish`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    })
    expect(body.status).toBe('PUBLISHED')

    // 已发布后再发布：409
    const again = await fetch(`/api/admin/courses/${courseId}/publish`, { method: 'POST', headers: { cookie: adminCookie } })
    expect(again.status).toBe(409)
  })

  it('管理员驳回：待审核 → 已驳回，理由落库且传承人可见', async () => {
    const courseId = await createDraftCourse('驳回课程丙')
    await $fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })

    const body = await $fetch<{ id: string, status: string, rejectReason: string | null }>(
      `/api/admin/courses/${courseId}/reject`,
      {
        method: 'POST',
        headers: { cookie: adminCookie, ...json },
        body: { reason: '步骤内容过于简略，请补充配图' },
      },
    )
    expect(body.status).toBe('REJECTED')
    expect(body.rejectReason).toBe('步骤内容过于简略，请补充配图')

    // 传承人在创作端详情里看到驳回理由
    const mine = await $fetch<{ status: string, rejectReason: string | null }>(`/api/studio/courses/${courseId}`, {
      headers: { cookie: inheritorCookie },
    })
    expect(mine.status).toBe('REJECTED')
    expect(mine.rejectReason).toBe('步骤内容过于简略，请补充配图')
  })

  it('驳回可不带理由；非法状态直接发布/驳回 409', async () => {
    const courseId = await createDraftCourse('驳回课程丁')
    // 草稿状态直接发布：409
    const early = await fetch(`/api/admin/courses/${courseId}/publish`, { method: 'POST', headers: { cookie: adminCookie } })
    expect(early.status).toBe(409)

    await $fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })
    const body = await $fetch<{ status: string, rejectReason: string | null }>(`/api/admin/courses/${courseId}/reject`, {
      method: 'POST',
      headers: { cookie: adminCookie, ...json },
      body: {},
    })
    expect(body.status).toBe('REJECTED')
    expect(body.rejectReason).toBeNull()
  })

  it('已驳回课程修改后可重新提交，旧理由被清空', async () => {
    const courseId = await createDraftCourse('重新提交课程')
    await $fetch(`/api/studio/courses/${courseId}/submit`, { method: 'POST', headers: { cookie: inheritorCookie } })
    await $fetch(`/api/admin/courses/${courseId}/reject`, {
      method: 'POST',
      headers: { cookie: adminCookie, ...json },
      body: { reason: '再改改' },
    })

    await $fetch(`/api/studio/courses/${courseId}`, {
      method: 'PUT',
      headers: { cookie: inheritorCookie, ...json },
      body: { intro: '修改后的简介' },
    })
    const resubmitted = await $fetch<{ status: string, rejectReason: string | null }>(
      `/api/studio/courses/${courseId}/submit`,
      { method: 'POST', headers: { cookie: inheritorCookie } },
    )
    expect(resubmitted.status).toBe('PENDING_REVIEW')
    expect(resubmitted.rejectReason).toBeNull()
  })

  it('作者（传承人）提交他人课程 404', async () => {
    const other = await prisma.user.create({
      data: { username: 'review_inheritor_2', displayName: '另一位传承人', passwordHash: 'test-hash', role: 'INHERITOR' },
    })
    const course = await createCourse(prisma, { craftItemId: item.id, authorId: other.id, status: 'DRAFT' })
    const res = await fetch(`/api/studio/courses/${course.id}/submit`, {
      method: 'POST',
      headers: { cookie: inheritorCookie },
    })
    expect(res.status).toBe(404)
  })
})
