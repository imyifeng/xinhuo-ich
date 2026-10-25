import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import {
  buildFeatureVector,
  type FeatureDimensionSpec,
  type FeatureVector,
  type LearnerBehaviorSummary,
} from '../recommendation/feature-vector'
import { chooseKByElbow, kMeans } from '../recommendation/kmeans'
import { buildTfidfModel, rankBySimilarity, vectorize, type TfidfModel } from '../recommendation/tfidf'
import { asImageList } from './craft-item.service'

/**
 * 画像与推荐离线管道（工单 #8 / ADR 0001，services 层）。
 *
 * 链路：聚合 behavior_event（五类学习行为是画像唯一数据源）→ 每位学习者特征向量
 * → 手肘法选 k → K-Means 聚类 → 画像标签落 learner_profile →
 * 同簇热门 + 标签 TF-IDF 相似落 recommendation。算法本体在 ../recommendation/ 纯函数层，
 * 本文件只负责取数、映射与落库（接缝 1 集成测试经 HTTP 触发本管道）。
 *
 * 规模取舍：平台学习者为百人量级，事件全量载入内存聚合（单次查询成本），
 * 不做增量计算——每日全量重建语义最简单，报告也好论述。
 */

/** 学习者少于该数时跳过聚类（k≥2 的聚类无统计意义），只做全站热门兜底（报告注明） */
export const MIN_LEARNERS_FOR_CLUSTERING = 4
/** 手肘法 k 候选上界（与规格一致：k ∈ [2, min(8, n-1)]） */
export const ELBOW_MAX_K = 8
/** K-Means 固定种子：离线重建可复现（同输入同输出，报告/调试需要） */
export const KMEANS_SEED = 42
/** 每位学习者落库的推荐条数上限（条目 + 课程分开计） */
export const RECOMMENDATION_ITEM_LIMIT = 5
export const RECOMMENDATION_COURSE_LIMIT = 3

const FALLBACK_REASON = '全站热门'
const CLUSTER_ITEM_REASON = '同好都在看'
const CLUSTER_COURSE_REASON = '同好都在学'
/** 无法用子类别命名的簇（成员几乎无条目浏览）退此通用标签 */
const GENERIC_CLUSTER_LABEL = '综合浏览型'

export interface RebuildResult {
  /** 参与聚合（有行为事件）的学习者数 */
  learnerCount: number
  /** 本次写库的画像数（跳过聚类时为 0） */
  profileCount: number
  /** 手肘法选出的 k（跳过聚类时为 null） */
  chosenK: number | null
  /** 各簇人数（跳过聚类时为空数组） */
  clusters: Array<{ clusterIndex: number, label: string, size: number }>
  /** 本次写库的推荐行数 */
  recommendationCount: number
  /** 是否因学习者过少跳过聚类 */
  skippedClustering: boolean
}

/** 管道内部：单个学习者的行为聚合视图 */
interface LearnerAggregation {
  summary: LearnerBehaviorSummary
  /** 已浏览条目（推荐排除用） */
  viewedItemIds: Set<string>
  /** 已开始/在学的课程（推荐排除用） */
  activeCourseIds: Set<string>
  /** 浏览最多的条目（TF-IDF 相似度种子；并列取 id 最小者） */
  topViewItem: { id: string, views: number } | null
}

/** 管道内部：当期内容清单（向量维度字典 + 推荐候选池） */
interface ContentCatalog {
  spec: FeatureDimensionSpec
  itemIds: string[]
  itemNames: Map<string, string>
  /** 条目 TF-IDF 向量（与全体条目标签构建的模型对齐） */
  itemVectors: Map<string, number[]>
  itemTagCounts: Map<string, number>
}

/** 单条推荐落库行 */
interface RecommendationRow {
  userId: number
  craftItemId: string | null
  courseId: string | null
  score: number
  reason: string
  generatedAt: Date
}

/** 计数表中最大值（热度归一化分母；空表为 0） */
function maxCount(counts: Map<string, number>): number {
  let max = 0
  for (const value of counts.values()) max = Math.max(max, value)
  return max
}

/** 并发防重入：每日 cron 与管理员手动触发撞车时共享同一次计算（singleflight 思路） */
let inFlightRebuild: Promise<RebuildResult> | null = null

/** 触发画像与推荐重建（管理员手动触发与每日 cron 共用入口） */
export function rebuildProfilesAndRecommendations(): Promise<RebuildResult> {
  inFlightRebuild ??= runRebuild().finally(() => {
    inFlightRebuild = null
  })
  return inFlightRebuild
}

async function runRebuild(): Promise<RebuildResult> {
  const db = usePrisma()
  const { catalog, learners } = await aggregateBehavior()

  const userIds = [...learners.keys()].sort((a, b) => a - b)
  const vectors = new Map<number, FeatureVector>()
  for (const userId of userIds) {
    vectors.set(userId, buildFeatureVector(learners.get(userId)!.summary, catalog.spec))
  }

  // ---- 手肘法选 k → K-Means 聚类 → 簇命名 ----
  let chosenK: number | null = null
  const assignments = new Map<number, number>()
  const clusters: RebuildResult['clusters'] = []

  if (userIds.length >= MIN_LEARNERS_FOR_CLUSTERING) {
    const data = userIds.map(id => vectors.get(id)!.values)
    chosenK = chooseKByElbow(data, { maxK: ELBOW_MAX_K, seed: KMEANS_SEED }).k
    const result = kMeans(data, { k: chosenK, seed: KMEANS_SEED })
    userIds.forEach((userId, i) => assignments.set(userId, result.assignments[i]!))

    // 簇命名：簇内各成员的子类别浏览占比取人均最大者 → "XX爱好者型"；
    // 人均最大仍为 0（整簇几乎不浏览条目）时无法命名，退"综合浏览型"；
    // 占比并列取字典序最小的子类别（确定性）。
    const subcategories = catalog.spec.subcategories
    for (let c = 0; c < chosenK; c++) {
      const memberIndexes = userIds.map((_, i) => i).filter(i => result.assignments[i] === c)
      let bestSubcategory: string | null = null
      let bestMeanShare = 0
      for (let s = 0; s < subcategories.length; s++) {
        const meanShare = memberIndexes.reduce(
          (sum, i) => sum + vectors.get(userIds[i]!)!.values[s]!,
          0,
        ) / memberIndexes.length
        if (meanShare > bestMeanShare + Number.EPSILON) {
          bestMeanShare = meanShare
          bestSubcategory = subcategories[s]!
        }
      }
      clusters.push({
        clusterIndex: c,
        label: bestSubcategory ? `${bestSubcategory}爱好者型` : GENERIC_CLUSTER_LABEL,
        size: memberIndexes.length,
      })
    }
  }

  const now = new Date()
  const profileRows = userIds
    .filter(userId => assignments.has(userId))
    .map(userId => {
      const clusterIndex = assignments.get(userId)!
      const label = clusters.find(c => c.clusterIndex === clusterIndex)!.label
      const vector = vectors.get(userId)!
      return {
        userId,
        clusterIndex,
        clusterLabel: label,
        // 自描述向量：维度名随值落库，管理端统计无需回溯当时的条目/课程清单
        featureVector: { dimensions: vector.dimensions, values: vector.values } as unknown as Prisma.InputJsonValue,
        updatedAt: now,
      }
    })

  const recommendationRows = buildRecommendationRows(catalog, learners, assignments)

  // 整批重建：先清后写（单事务），画像/推荐永远反映最近一次管道结果
  await db.$transaction([
    db.recommendation.deleteMany(),
    db.learnerProfile.deleteMany(),
    db.learnerProfile.createMany({ data: profileRows }),
    db.recommendation.createMany({ data: recommendationRows }),
  ])

  return {
    learnerCount: userIds.length,
    profileCount: profileRows.length,
    chosenK,
    clusters,
    recommendationCount: recommendationRows.length,
    skippedClustering: chosenK === null,
  }
}

/** 聚合五类行为事件 + 当期内容清单（条目/课程/标签），构成管道的全部输入 */
async function aggregateBehavior(): Promise<{
  catalog: ContentCatalog
  learners: Map<number, LearnerAggregation>
}> {
  const db = usePrisma()
  const [itemRows, courseRows, events] = await Promise.all([
    db.craftItem.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        subcategory: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: { id: 'asc' },
    }),
    db.course.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, _count: { select: { steps: true } } },
      orderBy: { id: 'asc' },
    }),
    db.behaviorEvent.findMany({
      where: { userId: { not: null } },
      select: { userId: true, type: true, targetId: true },
    }),
  ])

  // 维度字典：全体子类别（码元排序）+ 全体课程（id 排序），全体学习者共享同一定长向量
  const subcategories = [...new Set(itemRows.map(row => row.subcategory))].sort()
  const catalog: ContentCatalog = {
    spec: {
      subcategories,
      itemSubcategories: Object.fromEntries(itemRows.map(row => [row.id, row.subcategory])),
      courses: courseRows.map(row => ({ id: row.id, totalSteps: row._count.steps })),
    },
    itemIds: itemRows.map(row => row.id),
    itemNames: new Map(itemRows.map(row => [row.id, row.name])),
    itemTagCounts: new Map(),
    itemVectors: new Map(),
  }

  // TF-IDF 模型：全体已发布条目的标签集合（标签即"词"，每条目一个文档）
  const tagLists = new Map<string, string[]>(
    itemRows.map(row => [row.id, row.tags.map(tag => tag.tag.name)]),
  )
  const model: TfidfModel = buildTfidfModel([...tagLists.values()])
  for (const [itemId, tags] of tagLists) {
    catalog.itemVectors.set(itemId, vectorize(tags, model))
    catalog.itemTagCounts.set(itemId, tags.length)
  }

  const learners = new Map<number, LearnerAggregation>()
  const ensure = (userId: number): LearnerAggregation => {
    let entry = learners.get(userId)
    if (!entry) {
      entry = {
        summary: { itemViewCounts: {}, courseCompletedSteps: {}, postCount: 0, commentCount: 0 },
        viewedItemIds: new Set(),
        activeCourseIds: new Set(),
        topViewItem: null,
      }
      learners.set(userId, entry)
    }
    return entry
  }

  for (const event of events) {
    if (event.userId === null) continue
    const learner = ensure(event.userId)
    switch (event.type) {
      case 'VIEW_ITEM': {
        // 悬空目标（条目已删除）不计入向量也不计入热度，避免稀释浏览占比
        if (!catalog.itemNames.has(event.targetId)) break
        learner.summary.itemViewCounts[event.targetId] = (learner.summary.itemViewCounts[event.targetId] ?? 0) + 1
        learner.viewedItemIds.add(event.targetId)
        break
      }
      case 'COMPLETE_STEP': {
        // COMPLETE_STEP 每步骤仅记一次（写入侧幂等），按课程计数即该课程已完成步骤数
        if (!catalog.spec.courses.some(course => course.id === event.targetId)) break
        learner.summary.courseCompletedSteps[event.targetId] = (learner.summary.courseCompletedSteps[event.targetId] ?? 0) + 1
        learner.activeCourseIds.add(event.targetId)
        break
      }
      case 'START_COURSE': {
        learner.activeCourseIds.add(event.targetId)
        break
      }
      case 'CREATE_POST': {
        learner.summary.postCount += 1
        break
      }
      case 'CREATE_COMMENT': {
        learner.summary.commentCount += 1
        break
      }
    }
  }

  // TF-IDF 相似度种子：浏览最多的条目（次数并列取 id 最小者，确定性）
  for (const learner of learners.values()) {
    for (const [itemId, views] of Object.entries(learner.summary.itemViewCounts)) {
      if (!learner.topViewItem || views > learner.topViewItem.views
        || (views === learner.topViewItem.views && itemId < learner.topViewItem.id)) {
        learner.topViewItem = { id: itemId, views }
      }
    }
  }

  return { catalog, learners }
}

/** 汇总每位学习者的推荐落库行（同簇热门 + TF-IDF 相似；无画像者全站热门兜底） */
function buildRecommendationRows(
  catalog: ContentCatalog,
  learners: Map<number, LearnerAggregation>,
  assignments: Map<number, number>,
): RecommendationRow[] {
  const now = new Date()

  // 全站热度（一次性）：条目 = 全体学习者浏览次数；课程 = 全体学习者中开始该课程的人数
  const globalItemViews = new Map<string, number>()
  const globalCourseLearners = new Map<string, number>()
  for (const learner of learners.values()) {
    for (const [itemId, views] of Object.entries(learner.summary.itemViewCounts)) {
      globalItemViews.set(itemId, (globalItemViews.get(itemId) ?? 0) + views)
    }
    for (const courseId of learner.activeCourseIds) {
      globalCourseLearners.set(courseId, (globalCourseLearners.get(courseId) ?? 0) + 1)
    }
  }

  // 簇内热度（一次性，按簇聚合）：口径同上，但只统计同簇成员
  const clusterItemViews = new Map<number, Map<string, number>>()
  const clusterCourseLearners = new Map<number, Map<string, number>>()
  for (const [userId, learner] of learners) {
    const clusterIndex = assignments.get(userId)
    if (clusterIndex === undefined) continue
    const itemViews = clusterItemViews.get(clusterIndex) ?? new Map<string, number>()
    const courseLearners = clusterCourseLearners.get(clusterIndex) ?? new Map<string, number>()
    for (const [itemId, views] of Object.entries(learner.summary.itemViewCounts)) {
      itemViews.set(itemId, (itemViews.get(itemId) ?? 0) + views)
    }
    for (const courseId of learner.activeCourseIds) {
      courseLearners.set(courseId, (courseLearners.get(courseId) ?? 0) + 1)
    }
    clusterItemViews.set(clusterIndex, itemViews)
    clusterCourseLearners.set(clusterIndex, courseLearners)
  }

  const rows: RecommendationRow[] = []

  for (const [userId, learner] of learners) {
    const clusterIndex = assignments.get(userId)

    // ---- 冷启动（无画像 / 学习者过少跳过聚类）：全站热门兜底 ----
    if (clusterIndex === undefined) {
      const maxViews = maxCount(globalItemViews)
      catalog.itemIds
        .filter(itemId => !learner.viewedItemIds.has(itemId))
        .map(itemId => ({ itemId, heat: (globalItemViews.get(itemId) ?? 0) / (maxViews || 1) }))
        .sort((a, b) => b.heat - a.heat || (a.itemId < b.itemId ? -1 : 1))
        .slice(0, RECOMMENDATION_ITEM_LIMIT)
        .forEach(({ itemId, heat }) =>
          rows.push({ userId, craftItemId: itemId, courseId: null, score: heat, reason: FALLBACK_REASON, generatedAt: now }))
      appendTopCourses(rows, userId, catalog, globalCourseLearners, globalCourseLearners, learner.activeCourseIds, FALLBACK_REASON, now)
      continue
    }

    // ---- 条目候选：同簇热门 + TF-IDF 相似，同条目命中两源取高分 ----
    const clusterViews = clusterItemViews.get(clusterIndex)!
    const maxClusterViews = maxCount(clusterViews)
    const maxGlobalViews = maxCount(globalItemViews)
    // 簇内热度归一化到 [0,1]；簇内全零（新簇无浏览）退全站热度
    const clusterItemHeat = (itemId: string): number => {
      if (maxClusterViews > 0) return (clusterViews.get(itemId) ?? 0) / maxClusterViews
      return maxGlobalViews > 0 ? (globalItemViews.get(itemId) ?? 0) / maxGlobalViews : 0
    }

    const candidates = new Map<string, { score: number, reason: string }>()
    for (const itemId of catalog.itemIds) {
      if (learner.viewedItemIds.has(itemId)) continue
      const heat = clusterItemHeat(itemId)
      if (heat > 0) candidates.set(itemId, { score: heat, reason: CLUSTER_ITEM_REASON })
    }
    // TF-IDF 相似：种子 = 本人浏览最多的条目；余弦相似度 > 0 才构成推荐理由
    const seed = learner.topViewItem
    if (seed && (catalog.itemTagCounts.get(seed.id) ?? 0) > 0) {
      const similar = rankBySimilarity(
        catalog.itemVectors.get(seed.id)!,
        catalog.itemIds
          .filter(itemId => itemId !== seed.id && !learner.viewedItemIds.has(itemId))
          .map(itemId => ({ id: itemId, vector: catalog.itemVectors.get(itemId)! })),
      ).filter(entry => entry.similarity > 0)
      const reason = `与你看过《${catalog.itemNames.get(seed.id)}》相似`
      for (const entry of similar) {
        const existing = candidates.get(entry.id)
        if (!existing || entry.similarity > existing.score) {
          candidates.set(entry.id, { score: entry.similarity, reason })
        }
      }
    }

    ;[...candidates.entries()]
      .sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
      .slice(0, RECOMMENDATION_ITEM_LIMIT)
      .forEach(([itemId, { score, reason }]) =>
        rows.push({ userId, craftItemId: itemId, courseId: null, score, reason, generatedAt: now }))

    // ---- 课程候选：同簇学习人数排序，排除在学课程 ----
    // 口径与条目一致：某课程簇内无热度（同好还没人学）时退全站热度，保证推荐位不至于空缺
    appendTopCourses(
      rows,
      userId,
      catalog,
      clusterCourseLearners.get(clusterIndex)!,
      globalCourseLearners,
      learner.activeCourseIds,
      CLUSTER_COURSE_REASON,
      now,
    )
  }

  return rows
}

/**
 * 按热度取前 N 门课程（排除在学）：
 * 课程热度 = 簇内学习人数归一化；簇内该课程无人学时退全站归一化热度（cluster 与 global 传同一 Map 即纯全站口径）。
 */
function appendTopCourses(
  rows: RecommendationRow[],
  userId: number,
  catalog: ContentCatalog,
  clusterCourseLearners: Map<string, number>,
  globalCourseLearners: Map<string, number>,
  excludeCourseIds: Set<string>,
  reason: string,
  now: Date,
): void {
  const maxCluster = maxCount(clusterCourseLearners)
  const maxGlobal = maxCount(globalCourseLearners)
  const heatOf = (courseId: string): number => {
    const clusterCount = clusterCourseLearners.get(courseId) ?? 0
    if (clusterCount > 0) return clusterCount / (maxCluster || 1)
    return (globalCourseLearners.get(courseId) ?? 0) / (maxGlobal || 1)
  }
  catalog.spec.courses
    .filter(course => course.totalSteps > 0 && !excludeCourseIds.has(course.id))
    .map(course => ({ id: course.id, heat: heatOf(course.id) }))
    .filter(course => course.heat > 0)
    .sort((a, b) => b.heat - a.heat || (a.id < b.id ? -1 : 1))
    .slice(0, RECOMMENDATION_COURSE_LIMIT)
    .forEach(({ id, heat }) =>
      rows.push({ userId, craftItemId: null, courseId: id, score: heat, reason, generatedAt: now }))
}

// ---- 读取侧：前台推荐流与管理端画像统计（报告 5.1 素材） ----

export interface RecommendationFeedEntry {
  type: 'CRAFT_ITEM' | 'COURSE'
  craftItemId: string | null
  courseId: string | null
  /** 条目标题或课程标题 */
  title: string
  /** 条目 = 子类别；课程 = 所属条目名 */
  subtitle: string
  /** 条目封面图（课程为 null，课程卡片走标题排版） */
  image: { url: string, credit: string } | null
  score: number
  /** 汉字短理由，前台直接展示（"同好都在学"/"全站热门"等） */
  reason: string
}

export interface RecommendationFeed {
  /** 画像标签；无画像（冷启动）为 null */
  clusterLabel: string | null
  entries: RecommendationFeedEntry[]
}

/**
 * 某学习者的推荐流：优先读 recommendation 落库结果（离线管道产物），
 * 联表过滤已下架/已删除的目标；结果为空时实时全站热门兜底——
 * 冷启动学习者、刚注册或画像管道尚未跑过时也永远有内容可展示。
 */
export async function getRecommendationFeed(userId: number): Promise<RecommendationFeed> {
  const db = usePrisma()
  const [profile, recRows] = await Promise.all([
    db.learnerProfile.findUnique({ where: { userId }, select: { clusterLabel: true } }),
    db.recommendation.findMany({
      where: { userId },
      orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
    }),
  ])

  const itemIds = recRows.map(row => row.craftItemId).filter((id): id is string => id !== null)
  const courseIds = recRows.map(row => row.courseId).filter((id): id is string => id !== null)
  const [items, courses] = await Promise.all([
    itemIds.length
      ? db.craftItem.findMany({
          where: { id: { in: itemIds }, status: 'PUBLISHED' },
          select: { id: true, name: true, subcategory: true, images: true },
        })
      : Promise.resolve([]),
    courseIds.length
      ? db.course.findMany({
          where: { id: { in: courseIds }, status: 'PUBLISHED' },
          select: { id: true, title: true, craftItem: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ])
  const itemById = new Map(items.map(item => [item.id, item]))
  const courseById = new Map(courses.map(course => [course.id, course]))

  const entries: RecommendationFeedEntry[] = []
  for (const row of recRows) {
    if (row.craftItemId) {
      const item = itemById.get(row.craftItemId)
      if (!item) continue // 目标已删除/下架：跳过该行（下次重建自动清理）
      entries.push({
        type: 'CRAFT_ITEM',
        craftItemId: item.id,
        courseId: null,
        title: item.name,
        subtitle: item.subcategory,
        image: asImageList(item.images)[0] ?? null,
        score: row.score,
        reason: row.reason,
      })
    }
    else if (row.courseId) {
      const course = courseById.get(row.courseId)
      if (!course) continue
      entries.push({
        type: 'COURSE',
        craftItemId: null,
        courseId: course.id,
        title: course.title,
        subtitle: course.craftItem.name,
        image: null,
        score: row.score,
        reason: row.reason,
      })
    }
  }

  if (entries.length === 0) {
    entries.push(...await computePopularEntries(userId))
  }

  return { clusterLabel: profile?.clusterLabel ?? null, entries }
}

/** 实时全站热门（读取侧兜底）：条目按 VIEW_ITEM 次数、课程按开始人数，排除本人已浏览/在学 */
async function computePopularEntries(userId: number): Promise<RecommendationFeedEntry[]> {
  const db = usePrisma()
  const [viewEvents, startEvents, myItemViews, myCourseStarts] = await Promise.all([
    db.behaviorEvent.groupBy({
      by: ['targetId'],
      where: { type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', userId: { not: null } },
      _count: { _all: true },
    }),
    db.behaviorEvent.groupBy({
      by: ['targetId'],
      where: { type: 'START_COURSE', targetType: 'COURSE', userId: { not: null } },
      _count: { _all: true },
    }),
    db.behaviorEvent.findMany({
      where: { userId, type: 'VIEW_ITEM' },
      select: { targetId: true },
    }),
    db.behaviorEvent.findMany({
      where: { userId, type: { in: ['START_COURSE', 'COMPLETE_STEP'] } },
      select: { targetId: true },
    }),
  ])
  const viewedItemIds = new Set(myItemViews.map(row => row.targetId))
  const activeCourseIds = new Set(myCourseStarts.map(row => row.targetId))

  const maxViews = Math.max(1, ...viewEvents.map(row => row._count._all))
  const maxStarts = Math.max(1, ...startEvents.map(row => row._count._all))

  const topItemIds = viewEvents
    .filter(row => !viewedItemIds.has(row.targetId))
    .sort((a, b) => b._count._all - a._count._all || (a.targetId < b.targetId ? -1 : 1))
    .slice(0, RECOMMENDATION_ITEM_LIMIT)
  const topCourseIds = startEvents
    .filter(row => !activeCourseIds.has(row.targetId))
    .sort((a, b) => b._count._all - a._count._all || (a.targetId < b.targetId ? -1 : 1))
    .slice(0, RECOMMENDATION_COURSE_LIMIT)

  const [items, courses] = await Promise.all([
    topItemIds.length
      ? db.craftItem.findMany({
          where: { id: { in: topItemIds.map(row => row.targetId) }, status: 'PUBLISHED' },
          select: { id: true, name: true, subcategory: true, images: true },
        })
      : Promise.resolve([]),
    topCourseIds.length
      ? db.course.findMany({
          where: { id: { in: topCourseIds.map(row => row.targetId) }, status: 'PUBLISHED' },
          select: { id: true, title: true, craftItem: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ])
  const itemViewById = new Map(topItemIds.map(row => [row.targetId, row._count._all]))
  const courseStartById = new Map(topCourseIds.map(row => [row.targetId, row._count._all]))

  const entries: RecommendationFeedEntry[] = items.map(item => ({
    type: 'CRAFT_ITEM' as const,
    craftItemId: item.id,
    courseId: null,
    title: item.name,
    subtitle: item.subcategory,
    image: asImageList(item.images)[0] ?? null,
    score: (itemViewById.get(item.id) ?? 0) / maxViews,
    reason: FALLBACK_REASON,
  }))
  entries.push(...courses.map(course => ({
    type: 'COURSE' as const,
    craftItemId: null,
    courseId: course.id,
    title: course.title,
    subtitle: course.craftItem.name,
    image: null,
    score: (courseStartById.get(course.id) ?? 0) / maxStarts,
    reason: FALLBACK_REASON,
  })))
  return entries
}

// ---- 管理端画像统计 ----

export interface ProfileClusterStat {
  clusterIndex: number
  label: string
  /** 该簇人数 */
  size: number
  /** 各特征维度的簇内均值（特征均值表，报告 5.1 素材：可解释每簇为何被这样命名） */
  featureMeans: Array<{ dimension: string, value: number }>
}

export interface ProfileStats {
  totalProfiles: number
  clusters: ProfileClusterStat[]
  /** 最近一次重建时间（画像行 updatedAt 的最大值） */
  lastRebuiltAt: Date | null
}

/** 画像统计：各簇人数分布 + 特征均值表（管理端"画像统计"页数据源） */
export async function getProfileStats(): Promise<ProfileStats> {
  const db = usePrisma()
  const profiles = await db.learnerProfile.findMany({
    select: { clusterIndex: true, clusterLabel: true, featureVector: true, updatedAt: true },
    orderBy: { clusterIndex: 'asc' },
  })

  const byCluster = new Map<number, Array<{ label: string, vector: unknown, updatedAt: Date }>>()
  for (const profile of profiles) {
    const members = byCluster.get(profile.clusterIndex) ?? []
    members.push({ label: profile.clusterLabel, vector: profile.featureVector, updatedAt: profile.updatedAt })
    byCluster.set(profile.clusterIndex, members)
  }

  const lastRebuiltAt = profiles.reduce<Date | null>(
    (latest, profile) => (latest === null || profile.updatedAt > latest ? profile.updatedAt : latest),
    null,
  )

  const clusters: ProfileClusterStat[] = [...byCluster.entries()]
    .sort(([a], [b]) => a - b)
    .map(([clusterIndex, members]) => {
      // 特征向量自描述（{dimensions, values}），以首行维度名为准（同批重建维度一致）
      const first = parseFeatureVector(members[0]!.vector)
      const size = members.length
      const featureMeans = first
        ? first.dimensions.map((dimension, i) => ({
            dimension,
            value: members.reduce((sum, member) => {
              const vector = parseFeatureVector(member.vector)
              return sum + (vector?.values[i] ?? 0)
            }, 0) / size,
          }))
        : []
      return { clusterIndex, label: members[0]!.label, size, featureMeans }
    })

  return { totalProfiles: profiles.length, clusters, lastRebuiltAt }
}

/** 防御性解析落库的特征向量 JSON（脏数据返回 null，统计页不因单行脏数据崩溃） */
function parseFeatureVector(value: unknown): { dimensions: string[], values: number[] } | null {
  if (typeof value !== 'object' || value === null) return null
  const { dimensions, values } = value as { dimensions?: unknown, values?: unknown }
  if (!Array.isArray(dimensions) || !Array.isArray(values)) return null
  if (!dimensions.every(d => typeof d === 'string') || !values.every(v => typeof v === 'number')) return null
  return { dimensions, values }
}
