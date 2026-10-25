import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createCraftItem, resetCraftItemTables } from './helpers'

// 接缝 1：缓存开关（工单 #9）——CACHE_ENABLED=false 时全部请求 BYPASS：
// 直查数据库、不读写缓存与计数（压测对比基线的确定性保障）
describe('GET /api/craft-items/:id 缓存关闭（CACHE_ENABLED=false）', async () => {
  await setup({ server: true, env: { CACHE_ENABLED: 'false' } })

  let prisma: PrismaClient
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  it('所有请求返回 BYPASS 且内容正确，缓存计数不增长', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '旁路条目', features: ' bypass 后仍直查。' })
    const healthBefore = await $fetch<{ cache: { enabled: boolean, hit: number, miss: number } }>('/api/health')
    expect(healthBefore.cache.enabled).toBe(false)

    for (let i = 0; i < 3; i++) {
      const res = await fetch(`/api/craft-items/${item.id}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-cache')).toBe('BYPASS')
      expect(await res.json()).toMatchObject({ id: item.id, name: '旁路条目' })
    }

    const healthAfter = await $fetch<{ cache: { enabled: boolean, hit: number, miss: number } }>('/api/health')
    expect(healthAfter.cache.enabled).toBe(false)
    expect(healthAfter.cache.miss - healthBefore.cache.miss).toBe(0)
    expect(healthAfter.cache.hit - healthBefore.cache.hit).toBe(0)
  })

  it('缓存关闭下数据更新立即可见（无陈旧窗口）', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '改名前' })

    await fetch(`/api/craft-items/${item.id}`)
    await prisma.craftItem.update({ where: { id: item.id }, data: { name: '改名后' } })

    const res = await fetch(`/api/craft-items/${item.id}`)
    expect(res.headers.get('x-cache')).toBe('BYPASS')
    expect((await res.json()).name).toBe('改名后')
  })
})
