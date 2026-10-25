import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'
import '../prisma/load-env'

/**
 * demo:seed 演示数据管道（工单 #10）——交付脚本的集成测试。
 *
 * 规格 #1 的两个接缝（HTTP API / 算法纯函数）不覆盖交付脚本，这里把 npm script
 * 本身当作公共接口（命令行进 → 数据库状态出）验证工单验收标准：
 * - 演示账号（管理员/传承人/学习者）就位；
 * - 行为事件足以产出非空画像与非空推荐（事件量级为每人几十条、分布在近两周）；
 * - 重复执行幂等（先清后造：事件与学习记录总量不翻倍）。
 * 只断言库内最终状态与退出码，不断言脚本内部实现。
 */

const DEMO_LEARNER_USERNAMES = [
  'taotao', 'shanshan', 'muzi', 'jiujiu', 'xiaotie',
  'yaoyao', 'xiuxiu', 'momo', 'ququ', 'dingding',
]
const DEMO_USERNAMES = ['admin', 'inheritor', ...DEMO_LEARNER_USERNAMES]

function runDemoSeed() {
  execSync('pnpm exec tsx prisma/demo-seed.ts', {
    // globalSetup 已把 DATABASE_URL 指向测试库
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! },
    stdio: 'inherit',
  })
}

describe('demo:seed 演示数据管道', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('首跑：内容种子、演示账号、行为事件、画像与推荐全部就位', async () => {
    runDemoSeed()

    // ---- 内容种子就位：技艺条目（人工精选 28 项）与演示帖子 ----
    const craftItemCount = await prisma.craftItem.count()
    expect(craftItemCount).toBeGreaterThanOrEqual(20)
    const postCount = await prisma.post.count()
    expect(postCount).toBeGreaterThanOrEqual(5)

    // ---- 演示账号就位：角色正确 ----
    const users = await prisma.user.findMany({
      where: { username: { in: DEMO_USERNAMES } },
      select: { id: true, username: true, role: true },
    })
    expect(users.map(u => u.username).sort()).toEqual([...DEMO_USERNAMES].sort())
    expect(users.find(u => u.username === 'admin')?.role).toBe('ADMIN')
    expect(users.find(u => u.username === 'inheritor')?.role).toBe('INHERITOR')
    const learnerIds = users.filter(u => DEMO_LEARNER_USERNAMES.includes(u.username))
    expect(learnerIds.map(u => u.role).every(role => role === 'LEARNER')).toBe(true)

    // ---- 行为事件：每位演示学习者几十条、分布在近两周、五类齐全 ----
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    for (const learner of learnerIds) {
      const events = await prisma.behaviorEvent.findMany({
        where: { userId: learner.id },
        select: { type: true, createdAt: true },
      })
      // 几十条量级（下限保画像特征有料，上限防失控翻倍）
      expect(events.length).toBeGreaterThanOrEqual(25)
      expect(events.length).toBeLessThanOrEqual(150)
      // 时间分布近两周（不晚于当下、不早于 14 天前）
      for (const event of events) {
        expect(event.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000)
        expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(twoWeeksAgo - 60_000)
      }
      // 浏览与完成步骤（画像两大主特征）每位学习者都有
      expect(events.some(e => e.type === 'VIEW_ITEM')).toBe(true)
      expect(events.some(e => e.type === 'COMPLETE_STEP')).toBe(true)
    }
    // 五类事件在演示数据整体中齐全
    const allTypes = new Set(
      (await prisma.behaviorEvent.findMany({
        where: { userId: { in: learnerIds.map(u => u.id) } },
        select: { type: true },
      })).map(e => e.type),
    )
    expect([...allTypes].sort()).toEqual(['COMPLETE_STEP', 'CREATE_COMMENT', 'CREATE_POST', 'START_COURSE', 'VIEW_ITEM'])

    // ---- 偏好差异化：陶瓷型学习者七成以上浏览落在陶瓷条目 ----
    const taotao = learnerIds.find(u => u.username === 'taotao')!
    const taotaoViews = await prisma.behaviorEvent.findMany({
      where: { userId: taotao.id, type: 'VIEW_ITEM' },
      select: { targetId: true },
    })
    const ceramicItemIds = new Set(
      (await prisma.craftItem.findMany({ where: { subcategory: '陶瓷' }, select: { id: true } })).map(i => i.id),
    )
    const ceramicViews = taotaoViews.filter(e => ceramicItemIds.has(e.targetId)).length
    expect(ceramicViews / taotaoViews.length).toBeGreaterThan(0.7)

    // ---- 学习记录：演示学习者有可见的课程进度 ----
    for (const learner of learnerIds) {
      const recordCount = await prisma.learningRecord.count({ where: { userId: learner.id } })
      expect(recordCount).toBeGreaterThan(0)
    }

    // ---- 画像与推荐非空：管道已随脚本重建 ----
    const profiles = await prisma.learnerProfile.findMany({
      where: { userId: { in: learnerIds.map(u => u.id) } },
      select: { userId: true, clusterLabel: true },
    })
    expect(profiles.length).toBe(learnerIds.length)
    expect(profiles.every(p => p.clusterLabel.length > 0)).toBe(true)
    for (const learner of learnerIds) {
      const recCount = await prisma.recommendation.count({ where: { userId: learner.id } })
      expect(recCount).toBeGreaterThan(0)
    }
  })

  it('重跑幂等：行为事件与学习记录不翻倍，画像推荐依旧非空', async () => {
    const learnerIds = (await prisma.user.findMany({
      where: { username: { in: DEMO_LEARNER_USERNAMES } },
      select: { id: true },
    })).map(u => u.id)
    const eventCountBefore = await prisma.behaviorEvent.count({ where: { userId: { in: learnerIds } } })
    const recordCountBefore = await prisma.learningRecord.count({ where: { userId: { in: learnerIds } } })
    const postCountBefore = await prisma.post.count()
    const recCountBefore = await prisma.recommendation.count({ where: { userId: { in: learnerIds } } })

    runDemoSeed()

    expect(await prisma.behaviorEvent.count({ where: { userId: { in: learnerIds } } })).toBe(eventCountBefore)
    expect(await prisma.learningRecord.count({ where: { userId: { in: learnerIds } } })).toBe(recordCountBefore)
    expect(await prisma.post.count()).toBe(postCountBefore)
    expect(await prisma.recommendation.count({ where: { userId: { in: learnerIds } } })).toBeGreaterThan(0)
    expect(recCountBefore).toBeGreaterThan(0)
  })
})
