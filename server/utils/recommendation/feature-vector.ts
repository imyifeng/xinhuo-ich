/**
 * 特征向量构建（工单 #8 / ADR 0001，接缝 2 纯函数）——
 * 把一位学习者的行为聚合映射为定长数值向量，供 K-Means 欧氏聚类。
 *
 * 维度定义（顺序固定，报告 4.1 引用）：
 *   [0, S)   各子类别浏览占比 = 该子类别条目浏览次数 / 条目浏览总次数（无浏览时全 0）
 *   [S, S+C) 各课程学习进度 = 已完成步骤数 / 总步骤数（每门课程恒占一维，总步骤数为 0 时恒 0，防除零）
 *   [S+C]    发帖活跃度  = n/(n+5) 饱和归一化（单调有界，5 次 → 0.5）
 *   [S+C+1]  评论活跃度 = n/(n+5)
 *
 * 关键取舍：全体学习者共享同一份维度清单（spec 由调用方从当期条目/课程清单生成），
 * 向量长度只由 spec 决定 —— 跨学习者可比是 K-Means 的前提；
 * 浏览占比在用户内归一化（重度浏览者不放大绝对量，只体现兴趣结构）；
 * 活跃度用饱和式而非原始计数，避免发帖多的学习者一两个维度主导欧氏距离。
 */

/** 一位学习者的五类学习行为聚合（聚合本身由离线管道从 behavior_event 完成） */
export interface LearnerBehaviorSummary {
  /** 各技艺条目的 VIEW_ITEM 次数：key = craftItemId（可含已删除条目的悬空 ID，忽略） */
  itemViewCounts: Record<string, number>
  /** 各课程已完成步骤数：key = courseId（COMPLETE_STEP 每步骤仅记一次，天然去重） */
  courseCompletedSteps: Record<string, number>
  /** CREATE_POST 事件数 */
  postCount: number
  /** CREATE_COMMENT 事件数 */
  commentCount: number
}

/** 向量维度清单：全体学习者一致（同输入同长度），由当期条目/课程清单生成 */
export interface FeatureDimensionSpec {
  /** 全体子类别（调用方保证已按 UTF-16 码元排序，保证跨环境可复现） */
  subcategories: string[]
  /** 条目 → 子类别 映射（仅含有效已发布条目） */
  itemSubcategories: Record<string, string>
  /** 全体课程（调用方保证已按 id 排序），每门恒占一维 */
  courses: Array<{ id: string, totalSteps: number }>
}

/** 自描述特征向量：维度名随值落库，管理端统计与报告无需回溯当时的条目/课程清单 */
export interface FeatureVector {
  dimensions: string[]
  values: number[]
}

/** 发帖/评论活跃度的饱和常数：n/(n+5)，5 次达 0.5 —— 交流行为是兴趣信号而非主导信号 */
const ACTIVITY_SATURATION_K = 5

/** 发帖/评论活跃度：饱和归一化到 [0, 1) */
export function activityScore(count: number): number {
  return count / (count + ACTIVITY_SATURATION_K)
}

/** 构建特征向量：纯函数，无 IO；输入含悬空/脏数据时不抛错，按 0 维度处理 */
export function buildFeatureVector(
  summary: LearnerBehaviorSummary,
  spec: FeatureDimensionSpec,
): FeatureVector {
  const dimensions: string[] = []
  const values: number[] = []

  // -- 子类别浏览占比：分母只计有效条目（悬空 ID 不稀释占比） --
  let totalItemViews = 0
  const viewsBySubcategory = new Map<string, number>()
  for (const [itemId, count] of Object.entries(summary.itemViewCounts)) {
    const subcategory = spec.itemSubcategories[itemId]
    if (subcategory === undefined) continue
    totalItemViews += count
    viewsBySubcategory.set(subcategory, (viewsBySubcategory.get(subcategory) ?? 0) + count)
  }
  for (const subcategory of spec.subcategories) {
    dimensions.push(`浏览占比:${subcategory}`)
    values.push(totalItemViews > 0 ? (viewsBySubcategory.get(subcategory) ?? 0) / totalItemViews : 0)
  }

  // -- 课程学习进度 --
  for (const course of spec.courses) {
    dimensions.push(`完成度:${course.id}`)
    values.push(course.totalSteps > 0
      ? (summary.courseCompletedSteps[course.id] ?? 0) / course.totalSteps
      : 0)
  }

  // -- 交流活跃度 --
  dimensions.push('发帖活跃度')
  values.push(activityScore(summary.postCount))
  dimensions.push('评论活跃度')
  values.push(activityScore(summary.commentCount))

  return { dimensions, values }
}
