import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createComment, createPost, createUser, disconnectFixtureRedis, resetPostTables } from './helpers'

// 接缝 1：帖子详情（公开，工单 #7）—— 含可见评论列表；不存在或已下架一律 404
describe('帖子详情 GET /api/posts/:id', async () => {
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

  it('游客可看详情：正文、作者昵称与可见评论列表（按时间正序），下架评论不计', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma, 'detail-author')
    const commenter = await createUser(prisma, 'detail-commenter')
    const post = await createPost(prisma, author.id, {
      title: '第一件作品出窑了',
      content: '记录了开窑全过程，欢迎交流。',
    })
    await createComment(prisma, post.id, commenter.id, { content: '太漂亮了，求教程', createdAt: new Date('2026-01-02T00:00:00Z') })
    await createComment(prisma, post.id, commenter.id, { content: '同问烧成温度', createdAt: new Date('2026-01-03T00:00:00Z') })
    await createComment(prisma, post.id, commenter.id, { content: '被下架的评论', status: 'HIDDEN' })

    const body = await $fetch<any>(`/api/posts/${post.id}`)
    expect(body).toMatchObject({
      id: post.id,
      title: '第一件作品出窑了',
      content: '记录了开窑全过程，欢迎交流。',
      author: { id: author.id, displayName: '测试学习者' },
    })
    expect(body.comments.map((c: any) => c.content)).toEqual(['太漂亮了，求教程', '同问烧成温度'])
    expect(body.comments[0]).toMatchObject({ author: { displayName: '测试学习者' } })
  })

  it('已下架帖子返回 404', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const hidden = await createPost(prisma, author.id, { status: 'HIDDEN' })

    const res = await fetch(`/api/posts/${hidden.id}`)
    expect(res.status).toBe(404)
  })

  it('不存在的帖子 ID 返回 404', async () => {
    await resetPostTables(prisma)
    const res = await fetch('/api/posts/never-existed')
    expect(res.status).toBe(404)
  })
})
