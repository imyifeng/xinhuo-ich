import { describe, expect, it } from 'vitest'
import {
  buildFeatureVector,
  type FeatureDimensionSpec,
  type LearnerBehaviorSummary,
} from '../../../server/utils/recommendation/feature-vector'

// 接缝 2（规格 #1 测试决策）：特征向量构建为无 IO 纯函数，
// 用手算期望值做确定性断言。向量维度约定（报告 4.1 引用）：
//   [0, S)  各子类别浏览占比 = 该子类目条目浏览次数 / 条目浏览总次数（S = 子类别数）
//   [S, S+C) 各课程学习进度 = 已完成步骤数 / 总步骤数（C = 课程数，每门课程恒占一维，总步骤数为 0 时恒 0）
//   [S+C]   发帖活跃度 = n/(n+5)（饱和归一化，10 帖 ≈ 0.67）
//   [S+C+1] 评论活跃度 = n/(n+5)

const SPEC: FeatureDimensionSpec = {
  subcategories: ['陶瓷', '织绣'],
  itemSubcategories: { 'item-1': '陶瓷', 'item-2': '织绣', 'item-3': '陶瓷' },
  courses: [
    { id: 'course-1', totalSteps: 4 },
    { id: 'course-2', totalSteps: 0 },
  ],
}

function summary(overrides: Partial<LearnerBehaviorSummary> = {}): LearnerBehaviorSummary {
  return {
    itemViewCounts: {},
    courseCompletedSteps: {},
    postCount: 0,
    commentCount: 0,
    ...overrides,
  }
}

describe('buildFeatureVector', () => {
  it('维度顺序为 子类别浏览占比 → 课程完成度 → 发帖/评论活跃度，子类别按名称排序', () => {
    const { dimensions } = buildFeatureVector(summary(), SPEC)
    // 纯 UTF-16 码元排序（不用 localeCompare，保证跨环境一致）
    expect(dimensions).toEqual([
      '浏览占比:陶瓷',
      '浏览占比:织绣',
      '完成度:course-1',
      '完成度:course-2',
      '发帖活跃度',
      '评论活跃度',
    ])
  })

  it('浏览占比 = 子类别浏览次数 / 总浏览次数（手算：3+1 次中陶瓷占 3/4）', () => {
    const { values } = buildFeatureVector(
      summary({ itemViewCounts: { 'item-1': 3, 'item-2': 1 } }),
      SPEC,
    )
    expect(values[0]).toBeCloseTo(0.75, 12)
    expect(values[1]).toBeCloseTo(0.25, 12)
  })

  it('无条目浏览时各占比为 0 而非 NaN', () => {
    const { values } = buildFeatureVector(summary(), SPEC)
    expect(values[0]).toBe(0)
    expect(values[1]).toBe(0)
  })

  it('指向不存在条目的浏览事件不计入分子也不计入分母（悬空目标容错）', () => {
    const { values } = buildFeatureVector(
      summary({ itemViewCounts: { 'item-1': 3, ghost: 2 } }),
      SPEC,
    )
    expect(values[0]).toBe(1)
    expect(values[1]).toBe(0)
  })

  it('课程完成度 = 已完成步骤数 / 总步骤数；总步骤数为 0 的课程占维但恒为 0（防除零）', () => {
    const { dimensions, values } = buildFeatureVector(
      summary({ courseCompletedSteps: { 'course-1': 1, 'course-2': 3 } }),
      SPEC,
    )
    expect(dimensions[2]).toBe('完成度:course-1')
    expect(values[2]).toBeCloseTo(0.25, 12)
    expect(dimensions[3]).toBe('完成度:course-2')
    expect(values[3]).toBe(0)
  })

  it('发帖/评论活跃度 = n/(n+5) 饱和归一化（手算：5 帖 → 0.5，15 评论 → 0.75）', () => {
    const { values } = buildFeatureVector(summary({ postCount: 5, commentCount: 15 }), SPEC)
    expect(values[4]).toBeCloseTo(0.5, 12)
    expect(values[5]).toBeCloseTo(0.75, 12)
  })

  it('维度清单为空（无子类别无课程）时仅剩两个活跃度维度', () => {
    const { dimensions, values } = buildFeatureVector(summary(), {
      subcategories: [],
      itemSubcategories: {},
      courses: [],
    })
    expect(dimensions).toEqual(['发帖活跃度', '评论活跃度'])
    expect(values).toEqual([0, 0])
  })

  it('全体学习者共享同一维度清单：无行为学习者得到同长全零向量（K-Means 不产生 NaN）', () => {
    const active = buildFeatureVector(
      summary({ itemViewCounts: { 'item-1': 1 }, postCount: 1 }),
      SPEC,
    )
    const inactive = buildFeatureVector(summary(), SPEC)
    expect(inactive.dimensions).toEqual(active.dimensions)
    expect(inactive.values).toEqual([0, 0, 0, 0, 0, 0])
  })
})
