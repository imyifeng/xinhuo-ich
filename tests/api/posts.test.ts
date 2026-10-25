import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createComment, createPost, createUser, disconnectFixtureRedis, resetPostTables } from './helpers'

interface PostListItem {
  id: string
  title: string
  author: { id: number, displayName: string }
  commentCount: number
  createdAt: string
}

interface PostListResponse {
  items: PostListItem[]
  total: number
  page: number
  pageSize: number
}

// 接缝 1：交流区帖子列表（公开，工单 #7）—— 仅可见帖、时间倒序、作者昵称与评论数
describe('交流区帖子列表 GET /api/posts', async () => {
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

  it('仅返回 VISIBLE 帖子，按创建时间倒序，含作者昵称与可见评论数', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma, 'list-author')
    const commenter = await createUser(prisma, 'list-commenter')
    const oldPost = await createPost(prisma, author.id, { title: '最早的帖子', createdAt: new Date('2026-01-01T00:00:00Z') })
    await createPost(prisma, author.id, { title: '最新的帖子', createdAt: new Date('2026-01-03T00:00:00Z') })
    await createPost(prisma, author.id, { title: '已下架的帖子', status: 'HIDDEN' })
    await createComment(prisma, oldPost.id, commenter.id)
    await createComment(prisma, oldPost.id, commenter.id)
    await createComment(prisma, oldPost.id, commenter.id, { status: 'HIDDEN' })

    const body = await $fetch<PostListResponse>('/api/posts')
    expect(body.total).toBe(2)
    expect(body.items.map(p => p.title)).toEqual(['最新的帖子', '最早的帖子'])
    expect(body.items[1]).toMatchObject({
      id: oldPost.id,
      title: '最早的帖子',
      author: { id: author.id, displayName: '测试学习者' },
      commentCount: 2,
    })
  })

  it('分页：page/pageSize 切片并回传总数与页码', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    for (let i = 1; i <= 5; i++) {
      await createPost(prisma, author.id, { title: `帖子${i}`, createdAt: new Date(Date.UTC(2026, 0, i)) })
    }

    const body = await $fetch<PostListResponse>('/api/posts', { query: { page: 2, pageSize: 2 } })
    expect(body).toMatchObject({ total: 5, page: 2, pageSize: 2 })
    expect(body.items.map(p => p.title)).toEqual(['帖子3', '帖子2'])
  })
})
