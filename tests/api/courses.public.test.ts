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

// 接缝 1：课程公开浏览（工单 #6 / 用户故事 3、4、10）——
// 仅已发布课程对前台可见；游客可预览大纲（仅步骤标题），登录后可见步骤内容与学习进度。
describe('课程公开浏览 /api/courses', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let learnerCookie: string
  let itemA: Awaited<ReturnType<typeof createCraftItem>>
  let itemB: Awaited<ReturnType<typeof createCraftItem>>

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    itemA = await createCraftItem(prisma, { name: '浏览用条目甲' })
    itemB = await createCraftItem(prisma, { name: '浏览用条目乙' })
    const author = await createUser(prisma, 'public_inheritor', 'INHERITOR')
    const learner = await createUser(prisma, 'public_learner')

    // 甲条目：一门已发布（4 步）+ 一门草稿；乙条目：一门待审核
    const published = await createCourse(prisma, {
      craftItemId: itemA.id,
      authorId: author.id,
      status: 'PUBLISHED',
      title: '已发布课程',
      intro: '已发布课程简介',
    })
    for (let order = 1; order <= 4; order++) {
      await createStep(prisma, published.id, order, { title: `工序 ${order}`, content: `工序 ${order} 的详细内容` })
    }
    await createCourse(prisma, { craftItemId: itemA.id, authorId: author.id, status: 'DRAFT', title: '草稿课程' })
    const pending = await createCourse(prisma, { craftItemId: itemB.id, authorId: author.id, status: 'PENDING_REVIEW', title: '待审课程' })
    await createStep(prisma, pending.id, 1)

    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('课程列表仅含已发布课程，支持按条目筛选', async () => {
    const all = await $fetch<{ items: Array<{ id: string, title: string, craftItemId: string, craftItemName: string, stepCount: number }> }>('/api/courses')
    expect(all.items.map(c => c.title)).toEqual(['已发布课程'])
    expect(all.items[0]!.stepCount).toBe(4)
    expect(all.items[0]!.craftItemName).toBe('浏览用条目甲')

    const filteredA = await $fetch<{ items: Array<{ title: string }> }>(`/api/courses?craftItemId=${itemA.id}`)
    expect(filteredA.items.map(c => c.title)).toEqual(['已发布课程'])

    const filteredB = await $fetch<{ items: Array<{ title: string }> }>(`/api/courses?craftItemId=${itemB.id}`)
    expect(filteredB.items).toEqual([])
  })

  it('已发布课程详情：步骤按序返回', async () => {
    const published = await prisma.course.findFirstOrThrow({ where: { title: '已发布课程' } })
    const detail = await $fetch<{ id: string, title: string, craftItem: { id: string, name: string }, steps: Array<{ order: number, title: string }> }>(
      `/api/courses/${published.id}`,
    )
    expect(detail.craftItem.id).toBe(itemA.id)
    expect(detail.steps.map(s => s.order)).toEqual([1, 2, 3, 4])
    expect(detail.steps.map(s => s.title)).toEqual(['工序 1', '工序 2', '工序 3', '工序 4'])
  })

  it('游客详情仅见大纲：步骤 content 为 null，progress 为 null', async () => {
    const published = await prisma.course.findFirstOrThrow({ where: { title: '已发布课程' } })
    const detail = await $fetch<{ steps: Array<{ content: string | null }>, progress: unknown }>(`/api/courses/${published.id}`)
    expect(detail.steps.every(s => s.content === null)).toBe(true)
    expect(detail.progress).toBeNull()
  })

  it('登录用户详情：步骤内容可见，progress 返回已完成/总步骤', async () => {
    const published = await prisma.course.findFirstOrThrow({ where: { title: '已发布课程' } })
    // 预置：该学习者已完成第 1 步
    const step1 = await prisma.step.findFirstOrThrow({ where: { courseId: published.id, order: 1 } })
    const learner = await prisma.user.findUniqueOrThrow({ where: { username: 'public_learner' } })
    await prisma.learningRecord.create({ data: { userId: learner.id, stepId: step1.id } })

    const detail = await $fetch<{ steps: Array<{ order: number, content: string | null, completed: boolean }>, progress: { completedSteps: number, totalSteps: number } }>(
      `/api/courses/${published.id}`,
      { headers: { cookie: learnerCookie } },
    )
    expect(detail.steps.every(s => typeof s.content === 'string' && s.content.length > 0)).toBe(true)
    expect(detail.steps.map(s => s.completed)).toEqual([true, false, false, false])
    expect(detail.progress).toEqual({ completedSteps: 1, totalSteps: 4 })
  })

  it('未发布课程详情 404（草稿/待审核/已驳回一律不可见）', async () => {
    const draft = await prisma.course.findFirstOrThrow({ where: { title: '草稿课程' } })
    const pending = await prisma.course.findFirstOrThrow({ where: { title: '待审课程' } })
    const resDraft = await fetch(`/api/courses/${draft.id}`)
    expect(resDraft.status).toBe(404)
    const resPending = await fetch(`/api/courses/${pending.id}`)
    expect(resPending.status).toBe(404)
    const resMissing = await fetch('/api/courses/never-existed')
    expect(resMissing.status).toBe(404)
  })
})
