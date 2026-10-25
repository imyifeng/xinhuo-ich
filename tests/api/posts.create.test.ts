import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createSessionCookie, createUser, disconnectFixtureRedis, resetPostTables } from './helpers'

// 接缝 1：发帖（工单 #7 / 用户故事 8）—— 仅登录用户；CREATE_POST 事件落 behavior_event
describe('发帖 POST /api/posts', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  afterAll(async () => {
    await disconnectFixtureRedis()
  })

  it('未登录发帖返回 401，不落库不落事件', async () => {
    await resetPostTables(prisma)

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '游客的帖子', content: '正文' }),
    })
    expect(res.status).toBe(401)
    expect(await prisma.post.count()).toBe(0)
    expect(await prisma.behaviorEvent.count()).toBe(0)
  })

  it('无效会话（Redis 无此 token）返回 401', async () => {
    await resetPostTables(prisma)

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { cookie: 'xinhuo_session=not-a-real-token', 'content-type': 'application/json' },
      body: JSON.stringify({ title: '幽灵的帖子', content: '正文' }),
    })
    expect(res.status).toBe(401)
    expect(await prisma.post.count()).toBe(0)
  })

  it('登录学习者发帖成功：201 落库（默认可见），并写 CREATE_POST 事件', async () => {
    await resetPostTables(prisma)
    const user = await createUser(prisma, 'poster-learner')
    const cookie = await createSessionCookie(user.id)

    const body = await $fetch<any>('/api/posts', {
      method: 'POST',
      headers: { cookie },
      body: { title: '  第一次拉坯的心得  ', content: '今天终于拉出了第一个像样的碗底。' },
    })
    expect(body).toMatchObject({
      title: '第一次拉坯的心得',
      content: '今天终于拉出了第一个像样的碗底。',
      author: { id: user.id, displayName: '测试学习者' },
    })

    const row = await prisma.post.findUnique({ where: { id: body.id } })
    expect(row).toMatchObject({ authorId: user.id, status: 'VISIBLE' })

    const events = await prisma.behaviorEvent.findMany({ where: { userId: user.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'CREATE_POST', targetType: 'POST', targetId: body.id })
  })

  it('传承人与管理员也可发帖（仅登录即可）', async () => {
    await resetPostTables(prisma)
    const inheritor = await createUser(prisma, 'poster-inheritor', 'INHERITOR')
    const admin = await createUser(prisma, 'poster-admin', 'ADMIN')
    const inheritorCookie = await createSessionCookie(inheritor.id, 'INHERITOR')
    const adminCookie = await createSessionCookie(admin.id, 'ADMIN')

    const first = await $fetch<any>('/api/posts', {
      method: 'POST',
      headers: { cookie: inheritorCookie },
      body: { title: '传承人的帖子', content: '正文' },
    })
    const second = await $fetch<any>('/api/posts', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: { title: '管理员的帖子', content: '正文' },
    })
    expect((await prisma.post.findUnique({ where: { id: first.id } }))?.authorId).toBe(inheritor.id)
    expect((await prisma.post.findUnique({ where: { id: second.id } }))?.authorId).toBe(admin.id)
  })

  it('标题或正文缺失返回 400，不落库不落事件', async () => {
    await resetPostTables(prisma)
    const user = await createUser(prisma)
    const cookie = await createSessionCookie(user.id)

    const missingTitle = await fetch('/api/posts', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '只有正文' }),
    })
    expect(missingTitle.status).toBe(400)

    const blankTitle = await $fetch('/api/posts', {
      method: 'POST',
      headers: { cookie },
      body: { title: '   ', content: '只有正文' },
    }).catch((err: { statusCode?: number }) => err.statusCode)
    expect(blankTitle).toBe(400)

    expect(await prisma.post.count()).toBe(0)
    expect(await prisma.behaviorEvent.count()).toBe(0)
  })
})
