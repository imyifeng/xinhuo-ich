import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'

// 接缝 1：平台统计接口 —— 通过 HTTP 断言响应，通过 Prisma 造数（数据库状态作为夹具）
describe('GET /api/stats', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(() => {
    // globalSetup 已把 DATABASE_URL 指向测试库
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  it('空库时各计数为零', async () => {
    await prisma.craftItem.deleteMany()
    const body = await $fetch('/api/stats')
    expect(body).toEqual({ craftItemCount: 0, subcategoryCount: 0 })
  })

  it('返回技艺条目总数与去重后的子类别数', async () => {
    await prisma.craftItem.deleteMany()
    await prisma.craftItem.createMany({
      data: [
        { name: '测试条目甲', subcategory: '陶瓷', region: '江西省', batch: '第一批（2006 年）', code: 'Ⅷ-7', history: '历史', features: '特色' },
        { name: '测试条目乙', subcategory: '陶瓷', region: '浙江省', batch: '第一批（2006 年）', code: 'Ⅷ-9', history: '历史', features: '特色' },
        { name: '测试条目丙', subcategory: '织绣', region: '江苏省', batch: '第一批（2006 年）', code: 'Ⅷ-18', history: '历史', features: '特色' },
      ],
    })

    const body = await $fetch('/api/stats')
    expect(body).toEqual({ craftItemCount: 3, subcategoryCount: 2 })
  })
})
