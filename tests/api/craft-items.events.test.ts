import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createCraftItem, createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from './helpers'

// 接缝 1：浏览行为事件 —— 登录用户浏览详情落 VIEW_ITEM，游客不落（规格 #1 故事 27 第一类事件）
describe('技艺条目详情的 VIEW_ITEM 事件', async () => {
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

  it('登录用户浏览详情：写入 VIEW_ITEM 事件（用户/类型/目标齐全）', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '被浏览条目' })
    const user = await createUser(prisma)
    const cookie = await createSessionCookie(user.id)

    const res = await fetch(`/api/craft-items/${item.id}`, { headers: { cookie } })
    expect(res.status).toBe(200)

    const events = await prisma.behaviorEvent.findMany({ where: { targetId: item.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      userId: user.id,
      type: 'VIEW_ITEM',
      targetType: 'CRAFT_ITEM',
      targetId: item.id,
    })
  })

  it('游客浏览详情：不产生事件，详情仍正常返回', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '游客浏览条目' })

    const body = await $fetch(`/api/craft-items/${item.id}`)
    expect(body.id).toBe(item.id)

    const count = await prisma.behaviorEvent.count({ where: { targetId: item.id } })
    expect(count).toBe(0)
  })

  it('无效会话（Redis 无此 token）：不产生事件，详情仍 200', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '无效会话条目' })

    const res = await fetch(`/api/craft-items/${item.id}`, {
      headers: { cookie: 'xinhuo_session=not-a-real-token' },
    })
    expect(res.status).toBe(200)

    const count = await prisma.behaviorEvent.count({ where: { targetId: item.id } })
    expect(count).toBe(0)
  })

  it('404 的条目即使携带会话也不产生事件', async () => {
    await resetCraftItemTables(prisma)
    const user = await createUser(prisma)
    const cookie = await createSessionCookie(user.id)

    await fetch('/api/craft-items/never-existed', { headers: { cookie } })

    const count = await prisma.behaviorEvent.count({ where: { userId: user.id } })
    expect(count).toBe(0)
  })
})
