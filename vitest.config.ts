import { defineConfig } from 'vitest/config'

// 纯 API 集成测试（接缝 1，见规格 #1 测试决策）：
// - 不用 @nuxt/test-utils 的 nuxt 环境（无 DOM 测试），仅用 /e2e 入口起真实 Nitro 服务
// - globalSetup 负责测试数据库的创建与强制重置
export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    hookTimeout: 240_000,
    testTimeout: 30_000,
  },
})
