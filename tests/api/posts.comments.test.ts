import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createPost, createSessionCookie, createUser, disconnectFixtureRedis, resetPostTables } from './helpers'

// 接缝 1：评论（工单 #7 / 用户故事 9）—— 仅登录用户；CREATE_COMMENT 事件落 behavior_event
describe('评论帖子 POST /api/posts/:id/comments', async () => {
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

  it('未登录评论返回 401，不落库不落事件', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const post = await createPost(prisma, author.id)

    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '游客的评论' }),
    })
    expect(res.status).toBe(401)
    expect(await prisma.comment.count()).toBe(0)
    expect(await prisma.behaviorEvent.count()).toBe(0)
  })

  it('登录学习者评论成功：201 落库并写 CREATE_COMMENT 事件', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma, 'comment-post-author')
    const commenter = await createUser(prisma, 'comment-commenter')
    const post = await createPost(prisma, author.id)
    const cookie = await createSessionCookie(commenter.id)

    const body = await $fetch<any>(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { cookie },
      body: { content: '  求一份步骤详解！  ' },
    })
    expect(body).toMatchObject({
      content: '求一份步骤详解！',
      author: { id: commenter.id, displayName: '测试学习者' },
    })

    const row = await prisma.comment.findUnique({ where: { id: body.id } })
    expect(row).toMatchObject({ postId: post.id, authorId: commenter.id, status: 'VISIBLE' })

    const events = await prisma.behaviorEvent.findMany({ where: { userId: commenter.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'CREATE_COMMENT', targetType: 'COMMENT', targetId: body.id })
  })

  it('对不存在或已下架的帖子评论返回 404，不落库', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const hidden = await createPost(prisma, author.id, { status: 'HIDDEN' })
    const cookie = await createSessionCookie(author.id)

    const missing = await fetch('/api/posts/never-existed/comments', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '评论不存在的帖子' }),
    })
    expect(missing.status).toBe(404)

    const hiddenRes = await fetch(`/api/posts/${hidden.id}/comments`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '评论下架的帖子' }),
    })
    expect(hiddenRes.status).toBe(404)

    expect(await prisma.comment.count()).toBe(0)
    expect(await prisma.behaviorEvent.count()).toBe(0)
  })

  it('评论内容缺失返回 400', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const post = await createPost(prisma, author.id)
    const cookie = await createSessionCookie(author.id)

    await expect($fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { cookie },
      body: { content: '   ' },
    })).rejects.toMatchObject({ statusCode: 400 })
    expect(await prisma.comment.count()).toBe(0)
  })
})
