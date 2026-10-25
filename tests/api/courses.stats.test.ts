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

// 接缝 1：传承人课程统计（规格 #1 用户故事 18）——
// 课程详情浏览量（GET 详情原子自增，游客也计）与学习人数（该课程 START_COURSE 事件去重用户数，
// 行为事件是现成数据源）；传承人创作中心列表 API 返回两个字段并在页面展示。
describe('课程统计：浏览量与学习人数（用户故事 18）', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let inheritorCookie: string

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    await createUser(prisma, 'stats_inheritor', 'INHERITOR')
    inheritorCookie = await createSessionCookie(
      (await prisma.user.findUniqueOrThrow({ where: { username: 'stats_inheritor' } })).id,
      'INHERITOR',
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  async function authorId() {
    return (await prisma.user.findUniqueOrThrow({ where: { username: 'stats_inheritor' } })).id
  }

  it('游客浏览已发布课程详情：viewCount 原子自增（游客也计），登录浏览再 +1', async () => {
    const item = await createCraftItem(prisma, { name: '统计条目甲' })
    const course = await createCourse(prisma, { craftItemId: item.id, authorId: await authorId(), status: 'PUBLISHED' })

    await $fetch(`/api/courses/${course.id}`)
    await $fetch(`/api/courses/${course.id}`)
    const learner = await createUser(prisma, 'stats_learner_guest')
    await $fetch(`/api/courses/${course.id}`, { headers: { cookie: await createSessionCookie(learner.id) } })

    const row = await prisma.course.findUniqueOrThrow({ where: { id: course.id } })
    expect(row.viewCount).toBe(3)
  })

  it('未发布课程详情 404：不计浏览量', async () => {
    const item = await createCraftItem(prisma, { name: '统计条目乙' })
    const draft = await createCourse(prisma, { craftItemId: item.id, authorId: await authorId(), status: 'DRAFT' })

    const res = await fetch(`/api/courses/${draft.id}`)
    expect(res.status).toBe(404)

    const row = await prisma.course.findUniqueOrThrow({ where: { id: draft.id } })
    expect(row.viewCount).toBe(0)
  })

  it('学习人数 = 该课程 START_COURSE 事件去重用户数；创作中心列表返回浏览量与学习人数', async () => {
    const item = await createCraftItem(prisma, { name: '统计条目丙' })
    const course = await createCourse(prisma, { craftItemId: item.id, authorId: await authorId(), status: 'PUBLISHED' })
    const emptyCourse = await createCourse(prisma, { craftItemId: item.id, authorId: await authorId(), status: 'PUBLISHED', title: '无人学习的课程' })

    const learnerA = await createUser(prisma, 'stats_learner_a')
    const learnerB = await createUser(prisma, 'stats_learner_b')
    await $fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: await createSessionCookie(learnerA.id) } })
    // 同一学习者重复开始：幂等不重复记事件
    await $fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: await createSessionCookie(learnerA.id) } })
    await $fetch(`/api/courses/${course.id}/start`, { method: 'POST', headers: { cookie: await createSessionCookie(learnerB.id) } })
    // 脏数据兜底：直插同用户重复事件，学习人数仍按去重用户计
    await prisma.behaviorEvent.create({
      data: { userId: learnerA.id, type: 'START_COURSE', targetType: 'COURSE', targetId: course.id },
    })

    const body = await $fetch<{ items: Array<{ id: string, viewCount: number, learnerCount: number }> }>(
      '/api/studio/courses',
      { headers: { cookie: inheritorCookie } },
    )
    const withLearners = body.items.find(c => c.id === course.id)
    expect(withLearners).toBeDefined()
    expect(withLearners!.learnerCount).toBe(2)
    expect(typeof withLearners!.viewCount).toBe('number')

    const empty = body.items.find(c => c.id === emptyCourse.id)
    expect(empty).toBeDefined()
    expect(empty!.learnerCount).toBe(0)
  })
})
