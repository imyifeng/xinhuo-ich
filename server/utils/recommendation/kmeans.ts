/**
 * 手写 K-Means 与手肘法选 k（工单 #8 / ADR 0001，接缝 2 纯函数）。
 *
 * 实现要点与取舍（报告 4.1 引用）：
 * - 随机种子固定（mulberry32 伪随机数）：离线管道需要"同输入同输出"——
 *   重建结果可复现，报告与调试才能对着同一份聚类讲；k-means 本身对初始化敏感，
 *   固定 seed 消除这一不确定性来源。
 * - 初始化用 Forgy 法（seeded Fisher-Yates 洗牌取前 k 个样本点）而非 k-means++：
 *   样本量小（平台学习者数量级），Lloyd 迭代已能收敛到可用的局部最优，
 *   换取实现简单、行为完全确定。
 * - 距离为欧氏距离（内层用平方距离比较，避免无谓开方）。
 * - 空簇处理：某簇丢失全部成员时，把当前离自己质心最远的样本（并列取最小下标）
 *   移入该簇再继续迭代 —— 保证 k ≤ n 时输出永远没有空簇、每个质心都有归属。
 * - 收敛判据：划分不再变化即停；maxIterations 兜底防抖动死循环。
 * - k > n 时夹到 n（每点自成簇），空数据/单样本直接短路，不抛错。
 */

export interface KMeansOptions {
  /** 期望簇数；超过样本数时夹到样本数 */
  k: number
  /** 最大迭代次数（默认 100） */
  maxIterations?: number
  /** 随机种子（默认 0）；同 seed 同输入必得同输出 */
  seed?: number
}

export interface KMeansResult {
  /** 每个样本的簇编号（0 起） */
  assignments: number[]
  /** 每个簇的质心 */
  centroids: number[][]
  /** 簇内平方误差和 Σ‖x−centroid(assign(x))‖² */
  sse: number
  /** 实际执行的 Lloyd 迭代轮数 */
  iterations: number
}

const DEFAULT_MAX_ITERATIONS = 100

/** mulberry32：实现仅数行的可复现 PRNG，质性足够聚类初始化使用 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 平方欧氏距离（比较与求和均无需开方） */
function squaredDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return sum
}

/** Forgy 初始化：seeded Fisher-Yates 洗牌样本下标，取前 k 个样本点作初始质心 */
function pickInitialCentroids(data: number[][], k: number, rand: () => number): number[][] {
  const indices = data.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = indices[i]!
    indices[i] = indices[j]!
    indices[j] = tmp
  }
  return indices.slice(0, k).map(i => [...data[i]!])
}

/** 分配步：每个样本归到最近质心；距离并列取簇编号最小者（确定性） */
function assignToNearest(data: number[][], centroids: number[][]): number[] {
  return data.map((point) => {
    let best = 0
    let bestDistance = squaredDistance(point, centroids[0]!)
    for (let c = 1; c < centroids.length; c++) {
      const distance = squaredDistance(point, centroids[c]!)
      if (distance < bestDistance) {
        best = c
        bestDistance = distance
      }
    }
    return best
  })
}

/** 更新步：各簇质心取成员均值；空簇按"最远样本迁入"策略回填 */
function recomputeCentroids(
  data: number[][],
  assignments: number[],
  k: number,
  previousCentroids: number[][],
): number[][] {
  const dimension = data[0]!.length
  const membersByCluster: number[][] = Array.from({ length: k }, () => [])
  assignments.forEach((cluster, pointIndex) => membersByCluster[cluster]!.push(pointIndex))

  // 空簇回填：按簇编号升序处理；每轮迁出点不重复选（先到先得），并列取样本下标最小者
  const movedToEmpty = new Set<number>()
  for (let c = 0; c < k; c++) {
    if (membersByCluster[c]!.length > 0) continue
    let farthest = -1
    let farthestDistance = -1
    for (let i = 0; i < data.length; i++) {
      if (movedToEmpty.has(i)) continue
      const distance = squaredDistance(data[i]!, previousCentroids[assignments[i]!])
      if (distance > farthestDistance) {
        farthest = i
        farthestDistance = distance
      }
    }
    membersByCluster[c]!.push(farthest)
    movedToEmpty.add(farthest)
  }

  return membersByCluster.map((members, c) => {
    if (members.length === 0) return [...previousCentroids[c]!]
    const centroid = new Array<number>(dimension).fill(0)
    for (const i of members) {
      for (let d = 0; d < dimension; d++) centroid[d]! += data[i]![d]!
    }
    return centroid.map(value => value / members.length)
  })
}

/** K-Means 主流程：纯函数；k 夹到 [1, n]，空数据返回空结果 */
export function kMeans(data: number[][], options: KMeansOptions): KMeansResult {
  const n = data.length
  if (n === 0) return { assignments: [], centroids: [], sse: 0, iterations: 0 }
  const k = Math.max(1, Math.min(options.k, n))
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS

  const rand = mulberry32(options.seed ?? 0)
  let centroids = pickInitialCentroids(data, k, rand)
  let assignments = assignToNearest(data, centroids)

  let iterations = 0
  for (; iterations < maxIterations; iterations++) {
    const nextCentroids = recomputeCentroids(data, assignments, k, centroids)
    const nextAssignments = assignToNearest(data, nextCentroids)
    centroids = nextCentroids
    const converged = nextAssignments.every((a, i) => a === assignments[i])
    assignments = nextAssignments
    if (converged) {
      iterations += 1
      break
    }
  }

  const sse = data.reduce(
    (sum, point, i) => sum + squaredDistance(point, centroids[assignments[i]!]),
    0,
  )
  return { assignments, centroids, sse, iterations }
}

// ---- 手肘法选 k ----

export interface ElbowOptions {
  /** k 候选上界（默认 8） */
  maxK?: number
  /** 传给每次 kMeans 的随机种子 */
  seed?: number
}

export interface ElbowResult {
  /** 选出的 k */
  k: number
  /** k = 1..min(maxK, n) 的 SSE 曲线（报告画图素材）；空数据为空数组 */
  sseCurve: Array<{ k: number, sse: number }>
}

/**
 * 手肘法：对 k = 1..min(maxK, n) 各跑一次 K-Means 记录 SSE，
 * 取 SSE 曲线二阶差分 s(k-1) − 2s(k) + s(k+1) 最大的 k 为"肘部"（SSE 下降由陡转缓的拐点）；
 * 并列取最小 k（更少簇优先）。最终 k 落在 [2, min(maxK, n-1)]：
 * k=1 无聚类意义，k=n 每点一簇；样本不足以取 k≥2 时退 k=1（由调用方决定是否兜底跳过聚类）。
 */
export function chooseKByElbow(data: number[][], options: ElbowOptions = {}): ElbowResult {
  const n = data.length
  if (n === 0) return { k: 0, sseCurve: [] }
  const maxK = options.maxK ?? 8
  const seed = options.seed ?? 0

  const sseCurve: ElbowResult['sseCurve'] = []
  for (let k = 1; k <= Math.min(maxK, n); k++) {
    sseCurve.push({ k, sse: kMeans(data, { k, seed }).sse })
  }

  const kUpper = Math.min(maxK, n - 1)
  if (kUpper < 2) return { k: 1, sseCurve }

  // 候选 k 的二阶差分需要曲线邻居 k-1 与 k+1，故 k 至多到 min(kUpper, 曲线末位-1)
  let bestK = 2
  let bestCurvature = -Infinity
  for (let k = 2; k <= Math.min(kUpper, sseCurve.length - 1); k++) {
    const curvature = sseCurve[k - 2]!.sse - 2 * sseCurve[k - 1]!.sse + sseCurve[k]!.sse
    if (curvature > bestCurvature) {
      bestCurvature = curvature
      bestK = k
    }
  }
  return { k: bestK, sseCurve }
}
