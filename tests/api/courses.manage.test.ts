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

// 接缝 1：传承人端课程管理（工单 #6 用户故事 15-16）——
// 建课（挂条目）、更新课程信息、步骤增删改与重排；创建即草稿。
// 角色契约：未登录 401，学习者 403，管理员放行；他人课程一律 404（不泄漏存在性）。
describe('传承人端课程管理 /api/studio/courses', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let inheritorCookie: string
  let inheritor2Cookie: string
  let learnerCookie: string
  let adminCookie: string
  let item: Awaited<ReturnType<typeof createCraftItem>>

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    item = await createCraftItem(prisma, { name: '建课用条目' })
    const inheritor = await createUser(prisma, 'studio_inheritor', 'INHERITOR')
    const inheritor2 = await createUser(prisma, 'studio_inheritor_2', 'INHERITOR')
    const learner = await createUser(prisma, 'studio_learner')
    const admin = await createUser(prisma, 'studio_admin', 'ADMIN')
    inheritorCookie = await createSessionCookie(inheritor.id, 'INHERITOR')
    inheritor2Cookie = await createSessionCookie(inheritor2.id, 'INHERITOR')
    learnerCookie = await createSessionCookie(learner.id)
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  let courseId: string

  it('传承人创建课程：201，默认草稿状态，挂在指定条目下', async () => {
    const body = await $fetch<{ id: string, title: string, status: string, craftItemId: string }>(
      '/api/studio/courses',
      {
        method: 'POST',
        headers: { cookie: inheritorCookie },
        body: { title: '紫砂壶入门', intro: '从零开始认识紫砂', craftItemId: item.id },
      },
    )
    expect(body.title).toBe('紫砂壶入门')
    expect(body.status).toBe('DRAFT')
    expect(body.craftItemId).toBe(item.id)
    courseId = body.id

    const row = await prisma.course.findUnique({ where: { id: courseId } })
    expect(row).not.toBeNull()
    expect(row!.authorId).toBeGreaterThan(0)
  })

  it('未登录创建课程 401，学习者 403', async () => {
    const guest = await fetch('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: '', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 't', intro: 'i', craftItemId: item.id }),
    })
    expect(guest.status).toBe(401)

    const learner = await fetch('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: learnerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 't', intro: 'i', craftItemId: item.id }),
    })
    expect(learner.status).toBe(403)
  })

  it('缺字段或条目不存在：400', async () => {
    const missing = await fetch('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: inheritorCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', intro: '简介', craftItemId: item.id }),
    })
    expect(missing.status).toBe(400)

    const noItem = await fetch('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: inheritorCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '标题', intro: '简介', craftItemId: 'no-such-item' }),
    })
    expect(noItem.status).toBe(400)
  })

  it('传承人课程列表：只包含自己的课程', async () => {
    const author2 = await prisma.user.findUnique({ where: { username: 'studio_inheritor_2' } })
    await createCourse(prisma, { craftItemId: item.id, authorId: author2!.id, title: '别人的课程' })

    const body = await $fetch<{ items: Array<{ id: string, title: string, status: string, stepCount: number }> }>(
      '/api/studio/courses',
      { headers: { cookie: inheritorCookie } },
    )
    expect(body.items.map(c => c.title)).toEqual(['紫砂壶入门'])
    expect(body.items[0]!.status).toBe('DRAFT')
  })

  it('更新课程信息：标题/简介/挂载条目均可改', async () => {
    const item2 = await createCraftItem(prisma, { name: '建课用条目二' })
    const body = await $fetch<{ title: string, intro: string, craftItemId: string }>(
      `/api/studio/courses/${courseId}`,
      {
        method: 'PUT',
        headers: { cookie: inheritorCookie },
        body: { title: '紫砂壶入门（修订）', intro: '修订后的简介', craftItemId: item2.id },
      },
    )
    expect(body.title).toBe('紫砂壶入门（修订）')
    expect(body.craftItemId).toBe(item2.id)
    // 改回原条目，后续用例依赖
    await $fetch(`/api/studio/courses/${courseId}`, {
      method: 'PUT',
      headers: { cookie: inheritorCookie },
      body: { craftItemId: item.id },
    })
  })

  it('添加步骤：order 自动递增；更新与删除后序号保持连续', async () => {
    const step1 = await $fetch<{ id: string, order: number }>(`/api/studio/courses/${courseId}/steps`, {
      method: 'POST',
      headers: { cookie: inheritorCookie },
      body: { title: '练泥', content: '将紫砂泥反复捶打排气' },
    })
    expect(step1.order).toBe(1)
    const step2 = await $fetch<{ id: string, order: number }>(`/api/studio/courses/${courseId}/steps`, {
      method: 'POST',
      headers: { cookie: inheritorCookie },
      body: { title: '打身筒', content: '拍打泥片围成壶身' },
    })
    expect(step2.order).toBe(2)
    const step3 = await $fetch<{ id: string, order: number }>(`/api/studio/courses/${courseId}/steps`, {
      method: 'POST',
      headers: { cookie: inheritorCookie },
      body: { title: '明针', content: '用牛角明针光坯' },
    })
    expect(step3.order).toBe(3)

    // 更新步骤内容与配图
    const updated = await $fetch<{ title: string, content: string, imageUrl: string | null }>(
      `/api/studio/courses/${courseId}/steps/${step3.id}`,
      {
        method: 'PUT',
        headers: { cookie: inheritorCookie },
        body: { title: '明针光坯', imageUrl: 'https://example.com/mz.jpg' },
      },
    )
    expect(updated.title).toBe('明针光坯')
    expect(updated.imageUrl).toBe('https://example.com/mz.jpg')

    // 删除中间步骤后序号连续（1..2）
    const removed = await fetch(`/api/studio/courses/${courseId}/steps/${step2.id}`, {
      method: 'DELETE',
      headers: { cookie: inheritorCookie },
    })
    expect(removed.status).toBe(200)

    const detail = await $fetch<{ steps: Array<{ order: number, title: string }> }>(
      `/api/studio/courses/${courseId}`,
      { headers: { cookie: inheritorCookie } },
    )
    expect(detail.steps.map(s => s.order)).toEqual([1, 2])
    expect(detail.steps.map(s => s.title)).toEqual(['练泥', '明针光坯'])
  })

  it('重排步骤：按传入的 stepIds 顺序重排，非法入参 400', async () => {
    const detail = await $fetch<{ steps: Array<{ id: string, order: number }> }>(
      `/api/studio/courses/${courseId}`,
      { headers: { cookie: inheritorCookie } },
    )
    const [a, b] = detail.steps
    const reordered = await $fetch<{ steps: Array<{ id: string, order: number }> }>(
      `/api/studio/courses/${courseId}/steps/order`,
      {
        method: 'PUT',
        headers: { cookie: inheritorCookie },
        body: { stepIds: [b!.id, a!.id] },
      },
    )
    expect(reordered.steps[0]!.id).toBe(b!.id)
    expect(reordered.steps.map(s => s.order)).toEqual([1, 2])

    // 缺一个 id：不是全量重排，拒绝
    const incomplete = await fetch(`/api/studio/courses/${courseId}/steps/order`, {
      method: 'PUT',
      headers: { cookie: inheritorCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ stepIds: [a!.id] }),
    })
    expect(incomplete.status).toBe(400)
  })

  it('他人（传承人 B）读写删 A 的课程一律 404；管理员可读写', async () => {
    const resGet = await fetch(`/api/studio/courses/${courseId}`, { headers: { cookie: inheritor2Cookie } })
    expect(resGet.status).toBe(404)
    const resPut = await fetch(`/api/studio/courses/${courseId}`, {
      method: 'PUT',
      headers: { cookie: inheritor2Cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '劫持' }),
    })
    expect(resPut.status).toBe(404)
    const resDelete = await fetch(`/api/studio/courses/${courseId}`, {
      method: 'DELETE',
      headers: { cookie: inheritor2Cookie, 'content-type': 'application/json' },
    })
    expect(resDelete.status).toBe(404)
    const resStep = await fetch(`/api/studio/courses/${courseId}/steps`, {
      method: 'POST',
      headers: { cookie: inheritor2Cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x', content: 'y' }),
    })
    expect(resStep.status).toBe(404)

    const adminView = await $fetch<{ id: string }>(`/api/studio/courses/${courseId}`, {
      headers: { cookie: adminCookie },
    })
    expect(adminView.id).toBe(courseId)
  })

  it('待审核/已发布/已驳回的既有课程：非草稿不可编辑步骤与信息（已驳回可改）', async () => {
    const author = await prisma.user.findUnique({ where: { username: 'studio_inheritor' } })
    const pending = await createCourse(prisma, {
      craftItemId: item.id,
      authorId: author!.id,
      status: 'PENDING_REVIEW',
    })
    const res = await fetch(`/api/studio/courses/${pending.id}`, {
      method: 'PUT',
      headers: { cookie: inheritorCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '偷改' }),
    })
    expect(res.status).toBe(409)

    const rejected = await createCourse(prisma, {
      craftItemId: item.id,
      authorId: author!.id,
      status: 'REJECTED',
      rejectReason: '步骤内容过于简略',
    })
    const ok = await $fetch<{ status: string }>(`/api/studio/courses/${rejected.id}`, {
      method: 'PUT',
      headers: { cookie: inheritorCookie },
      body: { title: '驳回后修改' },
    })
    expect(ok.status).toBe('REJECTED')
  })

  it('删除课程：作者可删除自己的草稿', async () => {
    const mine = await $fetch<{ id: string }>('/api/studio/courses', {
      method: 'POST',
      headers: { cookie: inheritorCookie },
      body: { title: '待删除课程', intro: '简介', craftItemId: item.id },
    })
    const res = await fetch(`/api/studio/courses/${mine.id}`, {
      method: 'DELETE',
      headers: { cookie: inheritorCookie },
    })
    expect(res.status).toBe(200)
    expect(await prisma.course.findUnique({ where: { id: mine.id } })).toBeNull()
  })
})
