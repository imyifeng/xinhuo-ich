import { describe, expect, it } from 'vitest'
import { chooseKByElbow, kMeans } from '../../../server/utils/recommendation/kmeans'

// 接缝 2（规格 #1 测试决策）：K-Means 与手肘法为无 IO 纯函数，随机种子固定可复现。
// 手算样例：六个二维点天然两簇 {(0,0),(0,1),(1,0)} 与 {(5,5),(5,6),(6,5)}，
// 收敛后各簇内 SSE = 4/3（质心 (1/3,1/3)），总 SSE = 8/3。

/** 六个二维点、两个手工可验的紧致簇 */
const TWO_CLUSTER_DATA = [
  [0, 0],
  [0, 1],
  [1, 0],
  [5, 5],
  [5, 6],
  [6, 5],
]

describe('kMeans', () => {
  it('六个二维点分两簇：划分与手算一致，总 SSE = 8/3', () => {
    const result = kMeans(TWO_CLUSTER_DATA, { k: 2, seed: 42 })
    // 簇编号可整体置换，只断言划分等价：前三点同簇、后三点同簇、两组不同簇
    const [a0, a1, a2, b0, b1, b2] = result.assignments
    expect(a0).toBe(a1)
    expect(a0).toBe(a2)
    expect(b0).toBe(b1)
    expect(b0).toBe(b2)
    expect(a0).not.toBe(b0)
    expect(result.sse).toBeCloseTo(8 / 3, 9)
  })

  it('同 seed 同结果：质心与划分逐元素相等（可复现性）', () => {
    const first = kMeans(TWO_CLUSTER_DATA, { k: 3, seed: 7 })
    const second = kMeans(TWO_CLUSTER_DATA, { k: 3, seed: 7 })
    expect(second.assignments).toEqual(first.assignments)
    expect(second.centroids).toEqual(first.centroids)
    expect(second.sse).toBe(first.sse)
  })

  it('空数据返回空结果（assignments/centroids 为空、sse = 0），不抛错', () => {
    const result = kMeans([], { k: 2, seed: 42 })
    expect(result.assignments).toEqual([])
    expect(result.centroids).toEqual([])
    expect(result.sse).toBe(0)
  })

  it('单样本：k 夹到 1，样本自成一簇且 sse = 0', () => {
    const result = kMeans([[3, 4]], { k: 5, seed: 42 })
    expect(result.assignments).toEqual([0])
    expect(result.centroids).toEqual([[3, 4]])
    expect(result.sse).toBe(0)
  })

  it('k 大于样本数时夹到样本数：每点一簇、sse = 0（不抛错不产生空簇）', () => {
    const result = kMeans([[0], [10], [20]], { k: 8, seed: 42 })
    expect(result.centroids).toHaveLength(3)
    expect(new Set(result.assignments).size).toBe(3)
    expect(result.sse).toBe(0)
  })

  it('不变量：每个样本都被分到距其最近的质心（欧氏距离，含 maxIterations 提前截断的情况）', () => {
    const data = [
      [0, 0], [1, 1], [2, 0], [8, 8], [9, 9], [10, 8], [4, 9], [5, 10], [0, 9],
    ]
    const result = kMeans(data, { k: 3, seed: 1, maxIterations: 3 })
    const nearest = (point: number[]) => {
      let best = 0
      for (let c = 1; c < result.centroids.length; c++) {
        const dBest = dist2(point, result.centroids[best])
        const dCur = dist2(point, result.centroids[c])
        if (dCur < dBest) best = c
      }
      return best
    }
    data.forEach((point, i) => {
      expect(result.assignments[i]).toBe(nearest(point))
    })
  })

  it('不变量：k ≤ 样本数时任何 seed 下都不产生空簇', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const result = kMeans(TWO_CLUSTER_DATA, { k: 4, seed })
      const counts = new Map<number, number>()
      for (const a of result.assignments) counts.set(a, (counts.get(a) ?? 0) + 1)
      expect(counts.size).toBe(4)
      expect([...counts.values()].every(size => size >= 1)).toBe(true)
    }
  })

  it('全零向量（无行为学习者）可与正常向量同聚类，不产生 NaN', () => {
    const data = [[0, 0], [0, 0], [10, 10], [10, 10]]
    const result = kMeans(data, { k: 2, seed: 42 })
    expect(result.assignments.every(a => Number.isFinite(a))).toBe(true)
    expect(result.sse).toBeCloseTo(0, 12)
    expect(result.assignments[0]).toBe(result.assignments[1])
    expect(result.assignments[2]).toBe(result.assignments[3])
  })
})

function dist2(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return sum
}

describe('chooseKByElbow（手肘法）', () => {
  it('九个点三个分离紧致簇（手算各簇内 SSE = 2/3）：选出 k = 3', () => {
    const data = [
      [0, 0], [1, 0], [0, 1],
      [10, 10], [11, 10], [10, 11],
      [20, 0], [21, 0], [20, 1],
    ]
    const { k, sseCurve } = chooseKByElbow(data, { seed: 42 })
    expect(k).toBe(3)
    // 曲线覆盖 k = 1..min(8, n-1)（含基点 k=1 供二阶差分）
    expect(sseCurve.map(p => p.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(sseCurve[0]!.sse).toBeGreaterThan(sseCurve[2]!.sse)
  })

  it('n = 2 时无法取 k ≥ 2：退 k = 1', () => {
    const { k } = chooseKByElbow([[0, 0], [1, 1]], { seed: 42 })
    expect(k).toBe(1)
  })

  it('n = 3 时候选仅 k = 2：直接取 2', () => {
    const { k } = chooseKByElbow([[0], [1], [100]], { seed: 42 })
    expect(k).toBe(2)
  })

  it('空数据退 k = 0 且曲线为空', () => {
    const { k, sseCurve } = chooseKByElbow([], { seed: 42 })
    expect(k).toBe(0)
    expect(sseCurve).toEqual([])
  })
})
