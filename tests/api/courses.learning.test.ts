import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import {
  createCraftItem,
  createCourse,
  createSessionCookie,
  createUser,
  createStep,
  disconnectFixtureRedis,
  resetCraftItemTables,
} from './helpers'

// 接缝 1：学习进度与行为事件（工单 #6 / 用户故事 10-12、27）——
// 开始课程记 START_COURSE（每课程每用户仅一条）；标记完成写 learning_record + COMPLETE_STEP
// （重复完成幂等）；进度 = 已完成步骤数 / 课程总步骤数。
describe('学习进度与行为事件 /api/courses + /api/me/courses', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let aliceCookie: string
  let bobCookie: string
  let course: Awaited<ReturnType<typeof createCourse>>
  let courseB: Awaited<ReturnType<typeof createCourse>>

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '学习用条目' })
    const author = await createUser(prisma, 'learning_inheritor', 'INHERITOR')
    const alice = await createUser(prisma, 'learning_alice')
    const bob = await createUser(prisma, 'learning_bob')
    aliceCookie = await createSessionCookie(alice.id)
    bobCookie = await createSessionCookie(bob.id)

    course = await createCourse(prisma, { craftItemId: item.id, authorId: author.id, status: 'PUBLISHED', title: '学习进度课程' })
    for (let order = 1; order <= 3; order++) {
      await createStep(prisma, course.id, order, { title: `步骤 ${order}` })
    }
    courseB = await createCourse(prisma, { craftItemId: item.id, authorId: author.id, status: 'PUBLISHED', title: '第二门课程' })
    await createStep(prisma, courseB.id, 1)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('开始课程：写入 START_COURSE 事件（目标 COURSE）', async () => {
    const res = await fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: aliceCookie } })
    expect(res.status).toBe(200)

    const events = await prisma.behaviorEvent.findMany({ where: { type: 'START_COURSE', targetId: course.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ targetType: 'COURSE' })
  })

  it('重复开始与第二次请求：每课程每用户仅一条 START_COURSE 事件', async () => {
    await fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: aliceCookie } })
    await fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: aliceCookie } })

    const alice = await prisma.user.findUniqueOrThrow({ where: { username: 'learning_alice' } })
    const events = await prisma.behaviorEvent.findMany({ where: { userId: alice.id, type: 'START_COURSE', targetId: course.id } })
    expect(events).toHaveLength(1)
  })

  it('未登录开始课程 401；未发布课程 404', async () => {
    const guest = await fetch(`/api/courses/${course.id}/start`, { method: 'POST' })
    expect(guest.status).toBe(401)

    const draft = await createCourse(prisma, {
      craftItemId: (await prisma.craftItem.findFirstOrThrow()).id,
      authorId: (await prisma.user.findUniqueOrThrow({ where: { username: 'learning_inheritor' } })).id,
      status: 'DRAFT',
      title: '不可开始课程',
    })
    const res = await fetch(`/api/courses/${draft.id}/start`, { method: 'POST', headers: { cookie: aliceCookie } })
    expect(res.status).toBe(404)
  })

  it('标记步骤完成：learning_record 落库 + COMPLETE_STEP 事件，返回进度', async () => {
    const step1 = await prisma.step.findFirstOrThrow({ where: { courseId: course.id, order: 1 } })
    const body = await $fetch<{ completedSteps: number, totalSteps: number }>(
      `/api/courses/${course.id}/steps/${step1.id}/complete`,
      { method: 'POST', headers: { cookie: aliceCookie } },
    )
    expect(body).toEqual({ completedSteps: 1, totalSteps: 3 })

    const alice = await prisma.user.findUniqueOrThrow({ where: { username: 'learning_alice' } })
    const record = await prisma.learningRecord.findUnique({
      where: { userId_stepId: { userId: alice.id, stepId: step1.id } },
    })
    expect(record).not.toBeNull()

    const events = await prisma.behaviorEvent.findMany({ where: { userId: alice.id, type: 'COMPLETE_STEP', targetId: course.id } })
    expect(events).toHaveLength(1)
  })

  it('重复完成幂等：记录与 COMPLETE_STEP 事件均不重复', async () => {
    const step1 = await prisma.step.findFirstOrThrow({ where: { courseId: course.id, order: 1 } })
    const again = await $fetch<{ completedSteps: number }>(
      `/api/courses/${course.id}/steps/${step1.id}/complete`,
      { method: 'POST', headers: { cookie: aliceCookie } },
    )
    expect(again.completedSteps).toBe(1)

    const alice = await prisma.user.findUniqueOrThrow({ where: { username: 'learning_alice' } })
    const events = await prisma.behaviorEvent.findMany({ where: { userId: alice.id, type: 'COMPLETE_STEP', targetId: course.id } })
    expect(events).toHaveLength(1)
    const records = await prisma.learningRecord.findMany({ where: { userId: alice.id } })
    expect(records).toHaveLength(1)
  })

  it('不同用户、不同步骤互不干扰：进度各自累计', async () => {
    const step2 = await prisma.step.findFirstOrThrow({ where: { courseId: course.id, order: 2 } })
    const step3 = await prisma.step.findFirstOrThrow({ where: { courseId: course.id, order: 3 } })
    await $fetch(`/api/courses/${course.id}/steps/${step2.id}/complete`, { method: 'POST', headers: { cookie: aliceCookie } })
    await $fetch(`/api/courses/${course.id}/steps/${step3.id}/complete`, { method: 'POST', headers: { cookie: bobCookie } })

    const detail = await $fetch<{ progress: { completedSteps: number, totalSteps: number } }>(
      `/api/courses/${course.id}`,
      { headers: { cookie: aliceCookie } },
    )
    expect(detail.progress).toEqual({ completedSteps: 2, totalSteps: 3 })
  })

  it('未登录标记完成 401；未发布课程的步骤 404', async () => {
    const step1 = await prisma.step.findFirstOrThrow({ where: { courseId: course.id, order: 1 } })
    const guest = await fetch(`/api/courses/${course.id}/steps/${step1.id}/complete`, { method: 'POST' })
    expect(guest.status).toBe(401)

    const draftCourse = await createCourse(prisma, {
      craftItemId: (await prisma.craftItem.findFirstOrThrow()).id,
      authorId: (await prisma.user.findUniqueOrThrow({ where: { username: 'learning_inheritor' } })).id,
      status: 'DRAFT',
      title: '不可完成课程',
    })
    const draftStep = await createStep(prisma, draftCourse.id, 1)
    const res = await fetch(`/api/courses/${draftCourse.id}/steps/${draftStep.id}/complete`, {
      method: 'POST',
      headers: { cookie: aliceCookie },
    })
    expect(res.status).toBe(404)
  })

  it('我的课程进度：每门课已完成/总步骤，按最近完成时间排序', async () => {
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: 'learning_alice' } })
    // alice 再完成第二门课的步骤（比上一次完成更晚）
    const bStep1 = await prisma.step.findFirstOrThrow({ where: { courseId: courseB.id, order: 1 } })
    await prisma.learningRecord.update({
      where: { userId_stepId: { userId: alice.id, stepId: bStep1.id } },
      data: { completedAt: new Date() },
    }).catch(async () => {
      await prisma.learningRecord.create({ data: { userId: alice.id, stepId: bStep1.id, completedAt: new Date() } })
    })

    const body = await $fetch<{ items: Array<{ courseId: string, title: string, completedSteps: number, totalSteps: number }> }>(
      '/api/me/courses',
      { headers: { cookie: aliceCookie } },
    )
    expect(body.items).toHaveLength(2)
    expect(body.items[0]).toMatchObject({ courseId: courseB.id, title: '第二门课程', completedSteps: 1, totalSteps: 1 })
    expect(body.items[1]).toMatchObject({ courseId: course.id, title: '学习进度课程', completedSteps: 2, totalSteps: 3 })

    // bob 只完成过课程甲的第 3 步
    const bobBody = await $fetch<{ items: Array<{ courseId: string, completedSteps: number, totalSteps: number }> }>(
      '/api/me/courses',
      { headers: { cookie: bobCookie } },
    )
    expect(bobBody.items).toHaveLength(1)
    expect(bobBody.items[0]).toMatchObject({ courseId: course.id, completedSteps: 1, totalSteps: 3 })
  })

  it('未登录访问我的课程进度 401', async () => {
    const res = await fetch('/api/me/courses')
    expect(res.status).toBe(401)
  })
})
