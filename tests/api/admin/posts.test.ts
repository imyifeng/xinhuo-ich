import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createComment, createPost, createSessionCookie, createUser, disconnectFixtureRedis, resetPostTables } from '../helpers'

// 接缝 1：管理端内容审核（工单 #7 / 用户故事 24）——
// 帖子/评论下架与恢复；列表含 HIDDEN 可按状态筛；非管理员一律 403。
describe('管理端内容审核', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let adminCookie: string

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    const admin = await createUser(prisma, 'mod_admin', 'ADMIN')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('非管理员（未登录/学习者）访问管理帖子接口一律 403', async () => {
    const anonymous = await fetch('/api/admin/posts')
    expect(anonymous.status).toBe(403)

    const learner = await createUser(prisma, 'mod_learner')
    const learnerCookie = await createSessionCookie(learner.id)
    const learnerRes = await fetch('/api/admin/posts', { headers: { cookie: learnerCookie } })
    expect(learnerRes.status).toBe(403)
  })

  it('管理员帖子列表含已下架帖子，且可按状态筛选', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma, 'mod_author')
    const visible = await createPost(prisma, author.id, { title: '可见帖' })
    await createPost(prisma, author.id, { title: '隐藏帖', status: 'HIDDEN' })

    const all = await $fetch<any>('/api/admin/posts', { headers: { cookie: adminCookie } })
    expect(all.total).toBe(2)
    expect(all.items.map((p: any) => p.title).sort()).toEqual(['可见帖', '隐藏帖'])
    expect(all.items[0]).toMatchObject({ author: { displayName: '测试学习者' } })

    const hiddenOnly = await $fetch<any>('/api/admin/posts', {
      headers: { cookie: adminCookie },
      query: { status: 'HIDDEN' },
    })
    expect(hiddenOnly.total).toBe(1)
    expect(hiddenOnly.items[0]).toMatchObject({ title: '隐藏帖', status: 'HIDDEN' })

    const visibleOnly = await $fetch<any>('/api/admin/posts', {
      headers: { cookie: adminCookie },
      query: { status: 'VISIBLE' },
    })
    expect(visibleOnly.items.map((p: any) => p.title)).toEqual(['可见帖'])
    expect(visible.id).toBeTruthy()
  })

  it('下架帖子后公开列表/详情不可见，恢复后可见', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const post = await createPost(prisma, author.id, { title: '待下架帖' })

    const hidden = await $fetch<any>(`/api/admin/posts/${post.id}/status`, {
      method: 'PUT',
      headers: { cookie: adminCookie },
      body: { status: 'HIDDEN' },
    })
    expect(hidden).toMatchObject({ id: post.id, status: 'HIDDEN' })

    const listWhileHidden = await $fetch<any>('/api/posts')
    expect(listWhileHidden.total).toBe(0)
    expect((await fetch(`/api/posts/${post.id}`)).status).toBe(404)

    const restored = await $fetch<any>(`/api/admin/posts/${post.id}/status`, {
      method: 'PUT',
      headers: { cookie: adminCookie },
      body: { status: 'VISIBLE' },
    })
    expect(restored.status).toBe('VISIBLE')

    const listAfterRestore = await $fetch<any>('/api/posts')
    expect(listAfterRestore.total).toBe(1)
    expect((await fetch(`/api/posts/${post.id}`)).status).toBe(200)
  })

  it('下架不存在的帖子返回 404', async () => {
    await resetPostTables(prisma)
    const res = await fetch('/api/admin/posts/never-existed/status', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'HIDDEN' }),
    })
    expect(res.status).toBe(404)
  })

  it('管理员评论列表含状态与所属帖子，可按状态筛选', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const post = await createPost(prisma, author.id, { title: '有评论的帖子' })
    await createComment(prisma, post.id, author.id, { content: '可见评论' })
    await createComment(prisma, post.id, author.id, { content: '下架评论', status: 'HIDDEN' })

    const all = await $fetch<any>('/api/admin/comments', { headers: { cookie: adminCookie } })
    expect(all.total).toBe(2)
    expect(all.items[0]).toMatchObject({ post: { id: post.id, title: '有评论的帖子' } })

    const hiddenOnly = await $fetch<any>('/api/admin/comments', {
      headers: { cookie: adminCookie },
      query: { status: 'HIDDEN' },
    })
    expect(hiddenOnly.total).toBe(1)
    expect(hiddenOnly.items[0]).toMatchObject({ content: '下架评论', status: 'HIDDEN' })
  })

  it('下架评论后详情与评论数不含它，恢复后回来', async () => {
    await resetPostTables(prisma)
    const author = await createUser(prisma)
    const post = await createPost(prisma, author.id, { title: '评论审核帖' })
    const comment = await createComment(prisma, post.id, author.id, { content: '待审核评论' })

    const hidden = await $fetch<any>(`/api/admin/comments/${comment.id}/status`, {
      method: 'PUT',
      headers: { cookie: adminCookie },
      body: { status: 'HIDDEN' },
    })
    expect(hidden).toMatchObject({ id: comment.id, status: 'HIDDEN' })

    const detailWhileHidden = await $fetch<any>(`/api/posts/${post.id}`)
    expect(detailWhileHidden.comments).toHaveLength(0)
    const listWhileHidden = await $fetch<any>('/api/posts')
    expect(listWhileHidden.items[0].commentCount).toBe(0)

    await $fetch<any>(`/api/admin/comments/${comment.id}/status`, {
      method: 'PUT',
      headers: { cookie: adminCookie },
      body: { status: 'VISIBLE' },
    })

    const detailAfterRestore = await $fetch<any>(`/api/posts/${post.id}`)
    expect(detailAfterRestore.comments.map((c: any) => c.id)).toEqual([comment.id])
    const listAfterRestore = await $fetch<any>('/api/posts')
    expect(listAfterRestore.items[0].commentCount).toBe(1)
  })

  it('下架不存在的评论返回 404', async () => {
    await resetPostTables(prisma)
    const res = await fetch('/api/admin/comments/never-existed/status', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'HIDDEN' }),
    })
    expect(res.status).toBe(404)
  })
})
