import { describe, expect, it } from 'vitest'
import {
  buildTfidfModel,
  cosineSimilarity,
  rankBySimilarity,
  vectorize,
} from '../../../server/utils/recommendation/tfidf'

// 接缝 2（规格 #1 测试决策）：TF-IDF 与余弦相似度为无 IO 纯函数，手算期望值断言。
// 定义（报告 4.1 引用）：条目标签集合视为一篇文档（标签即词），
//   tf(t, d) = t 在 d 中出现次数；idf(t) = ln(N / df(t))（df = 含 t 的文档数）；
//   w(t, d) = tf · idf；余弦相似度 cos(a, b) = a·b / (‖a‖‖b‖)，零向量相似度定义为 0。

describe('buildTfidfModel + vectorize', () => {
  // 语料：doc0 = ['a','b']，doc1 = ['a','c']，doc2 = ['b','c','d']，N = 3
  // df: a=2, b=2, c=2, d=1 → idf(a)=idf(b)=idf(c)=ln(3/2)，idf(d)=ln(3)
  const docs = [['a', 'b'], ['a', 'c'], ['b', 'c', 'd']]

  it('词表按码元排序，idf = ln(N/df)（手算：ln(3/2) 与 ln(3)）', () => {
    const model = buildTfidfModel(docs)
    expect(model.terms).toEqual(['a', 'b', 'c', 'd'])
    const ln15 = Math.log(3 / 2)
    expect(model.idf).toEqual([ln15, ln15, ln15, Math.log(3)])
  })

  it('向量 = tf·idf（手算：doc0 权重 [ln(3/2), ln(3/2), 0, 0]）', () => {
    const model = buildTfidfModel(docs)
    expect(vectorize(['a', 'b'], model)).toEqual([Math.log(3 / 2), Math.log(3 / 2), 0, 0])
  })

  it('词频计入重复标签（tf = 2）', () => {
    const model = buildTfidfModel([['x'], ['y']])
    expect(vectorize(['x', 'x'], model)[0]).toBeCloseTo(2 * Math.log(2), 12)
  })

  it('语料外词汇不进向量（维度对齐词表，不越界）', () => {
    const model = buildTfidfModel(docs)
    expect(vectorize(['a', 'ghost'], model)).toEqual([Math.log(3 / 2), 0, 0, 0])
  })

  it('空语料：空模型与零向量，不抛错', () => {
    const model = buildTfidfModel([])
    expect(model.terms).toEqual([])
    expect(vectorize(['a'], model)).toEqual([])
  })

  it('出现在全部文档的词 idf = 0（无区分度，自动失效）', () => {
    const model = buildTfidfModel([['common', 'x'], ['common', 'y']])
    expect(model.idf[model.terms.indexOf('common')]).toBe(0)
  })
})

describe('cosineSimilarity', () => {
  it('手算：cos([1,0],[1,1]) = 1/√2', () => {
    expect(cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(1 / Math.SQRT2, 12)
  })

  it('同向向量相似度为 1，正交为 0', () => {
    expect(cosineSimilarity([2, 0], [5, 0])).toBeCloseTo(1, 12)
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  })

  it('零向量（无标签条目）相似度定义为 0 而非 NaN', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })

  it('空向量相似度为 0', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })
})

describe('rankBySimilarity', () => {
  it('按与种子向量的余弦相似度降序排列', () => {
    // 种子 [1,0]：a 完全同向（1）> c 夹角 45°（1/√2）> b 正交（0）
    const ranked = rankBySimilarity([1, 0], [
      { id: 'b', vector: [0, 1] },
      { id: 'a', vector: [1, 0] },
      { id: 'c', vector: [1, 1] },
    ])
    expect(ranked.map(r => r.id)).toEqual(['a', 'c', 'b'])
    expect(ranked[0]!.similarity).toBeCloseTo(1, 12)
    expect(ranked[1]!.similarity).toBeCloseTo(1 / Math.SQRT2, 12)
    expect(ranked[2]!.similarity).toBe(0)
  })

  it('相似度并列时按 id 升序（确定性）', () => {
    const ranked = rankBySimilarity([1, 0], [
      { id: 'd', vector: [2, 0] },
      { id: 'a', vector: [3, 0] },
    ])
    expect(ranked.map(r => r.id)).toEqual(['a', 'd'])
  })

  it('空候选池返回空列表', () => {
    expect(rankBySimilarity([1], [])).toEqual([])
  })
})
