import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { invalidateCraftItem } from '../../server/utils/services/craft-item.service'
import { createCraftItem, resetCraftItemTables } from './helpers'

/** /api/health 响应中与本工单相关的缓存统计段 */
interface HealthBody {
  cache: { enabled: boolean, hit: number, miss: number }
}

// 接缝 1：技艺条目详情缓存（工单 #9）——只断言外部可观测行为：
// 响应体内容、X-Cache 响应头、/api/health 的缓存计数
describe('GET /api/craft-items/:id 缓存（cache-aside）', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  it('首次请求 MISS 回源，二次请求 HIT 且内容一致', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, {
      name: '缓存条目',
      history: '唐代起烧造。',
      images: [{ url: 'https://example.com/cache.jpg', credit: '李四, CC BY 4.0' }],
    })

    const first = await fetch(`/api/craft-items/${item.id}`)
    expect(first.status).toBe(200)
    expect(first.headers.get('x-cache')).toBe('MISS')
    const firstBody = await first.json()

    const second = await fetch(`/api/craft-items/${item.id}`)
    expect(second.status).toBe(200)
    expect(second.headers.get('x-cache')).toBe('HIT')
    const secondBody = await second.json()
    expect(secondBody).toEqual(firstBody)
    expect(secondBody).toMatchObject({ id: item.id, name: '缓存条目' })
  })

  it('数据更新后缓存仍返回旧值，经失效路径取到新值（MISS 重建后 HIT）', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '更名前' })

    const stale = await fetch(`/api/craft-items/${item.id}`)
    expect(stale.headers.get('x-cache')).toBe('MISS')

    // 管理端变更入库（T4 admin API 并行开发中，此处以夹具直写数据库模拟）
    await prisma.craftItem.update({ where: { id: item.id }, data: { name: '更名后' } })

    const cached = await fetch(`/api/craft-items/${item.id}`)
    expect(cached.headers.get('x-cache')).toBe('HIT')
    expect((await cached.json()).name).toBe('更名前')

    // 确定性失效路径：service 层 invalidateCraftItem（后续由 T4 admin 写路径接线）
    await invalidateCraftItem(item.id)

    const rebuilt = await fetch(`/api/craft-items/${item.id}`)
    expect(rebuilt.headers.get('x-cache')).toBe('MISS')
    expect((await rebuilt.json()).name).toBe('更名后')

    const cachedAgain = await fetch(`/api/craft-items/${item.id}`)
    expect(cachedAgain.headers.get('x-cache')).toBe('HIT')
    expect((await cachedAgain.json()).name).toBe('更名后')
  })

  it('不存在的 ID：404 首次 MISS，空值缓存期内重复请求为 HIT 且不再产生 MISS 计数', async () => {
    const healthBefore = await $fetch<HealthBody>('/api/health')

    const missingId = `no-such-item-${Math.random().toString(36).slice(2)}`
    const first = await fetch(`/api/craft-items/${missingId}`)
    expect(first.status).toBe(404)
    expect(first.headers.get('x-cache')).toBe('MISS')

    const second = await fetch(`/api/craft-items/${missingId}`)
    expect(second.status).toBe(404)
    expect(second.headers.get('x-cache')).toBe('HIT')

    const third = await fetch(`/api/craft-items/${missingId}`)
    expect(third.status).toBe(404)
    expect(third.headers.get('x-cache')).toBe('HIT')

    const healthAfter = await $fetch<HealthBody>('/api/health')
    expect(healthAfter.cache.enabled).toBe(true)
    expect(healthAfter.cache.miss - healthBefore.cache.miss).toBe(1)
    expect(healthAfter.cache.hit - healthBefore.cache.hit).toBe(2)
  })

  it('并发请求同一未缓存条目：只回源一次（MISS 计数 +1），响应均为 200 且内容一致', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '并发条目' })
    const healthBefore = await $fetch<HealthBody>('/api/health')

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => fetch(`/api/craft-items/${item.id}`)),
    )

    expect(responses.every(r => r.status === 200)).toBe(true)
    // 未开启 BYPASS：全部走缓存路径（并发下先到者为 MISS、后到者可能 HIT，但都不是 BYPASS）
    const outcomes = responses.map(r => r.headers.get('x-cache'))
    expect(outcomes.every(v => v === 'MISS' || v === 'HIT')).toBe(true)
    expect(outcomes).toContain('MISS')

    const bodies = await Promise.all(responses.map(r => r.json()))
    expect(new Set(bodies.map(b => JSON.stringify(b))).size).toBe(1)
    expect(bodies[0]).toMatchObject({ id: item.id, name: '并发条目' })

    // 互斥重建可观测：20 个并发请求只产生 1 次回源（MISS 计数）
    const healthAfter = await $fetch<HealthBody>('/api/health')
    expect(healthAfter.cache.miss - healthBefore.cache.miss).toBe(1)
  })
})
