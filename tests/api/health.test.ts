import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

// 接缝 1：HTTP API 集成测试 —— 真实 Nitro 服务 + 测试专用 Postgres（globalSetup 已重置）
describe('GET /api/health', async () => {
  await setup({ server: true })

  it('返回 ok 状态并报告数据库与 Redis 均可用', async () => {
    const body = await $fetch('/api/health')
    expect(body.status).toBe('ok')
    expect(body.checks).toMatchObject({ database: 'up', redis: 'up' })
  })

  it('报告进程运行时长与响应时间戳', async () => {
    const body = await $fetch('/api/health')
    expect(body.uptime).toBeTypeOf('number')
    expect(body.uptime).toBeGreaterThan(0)
    expect(body.timestamp).toBeTypeOf('string')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })
})
