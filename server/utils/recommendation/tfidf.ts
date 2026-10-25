/**
 * 标签 TF-IDF 与余弦相似度（工单 #8 / ADR 0001，接缝 2 纯函数）。
 *
 * 模型定义（报告 4.1 引用）：技艺条目的标签集合视为一篇文档（标签即"词"，每条目一个文档），
 *   tf(t, d) = 标签 t 在条目 d 标签中的出现次数；
 *   idf(t) = ln(N / df(t))，df = 含 t 的文档数 —— 出现在全部条目的标签 idf = 0，自动失去区分度；
 *   权重 w(t, d) = tf · idf；条目间相似度 = TF-IDF 向量的余弦相似度 ∈ [0, 1]（标签权重非负）。
 *
 * 取舍：idf 不加平滑（语料是平台自有的条目标签全集，量小且封闭，纯对数式手算可复现、
 * 报告可逐步验算）；语料外标签直接丢弃（维度必须与词表对齐）；零向量相似度定义为 0
 * （无标签条目与任何条目都不相似，避免 NaN 污染排序）。
 */

/** TF-IDF 模型：词表与各词的 idf（下标对齐），由全体条目标签一次性构建 */
export interface TfidfModel {
  /** 词表（UTF-16 码元升序，保证跨环境可复现） */
  terms: string[]
  /** terms[i] 的逆文档频率 ln(N/df)；idf[i] = 0 表示无区分度词 */
  idf: number[]
}

/** 构建 TF-IDF 模型：docs[i] 为第 i 个条目的标签列表 */
export function buildTfidfModel(docs: string[][]): TfidfModel {
  const termSet = new Set<string>()
  for (const doc of docs) {
    for (const term of doc) termSet.add(term)
  }
  const terms = [...termSet].sort()
  const termIndex = new Map(terms.map((term, i) => [term, i]))

  const n = docs.length
  const documentFrequency = new Array<number>(terms.length).fill(0)
  for (const doc of docs) {
    for (const term of new Set(doc)) {
      documentFrequency[termIndex.get(term)!]! += 1
    }
  }
  const idf = documentFrequency.map(df => Math.log(n / df))
  return { terms, idf }
}

/** 把一个标签集合映射为 TF-IDF 向量（维度与 model.terms 对齐；语料外标签丢弃） */
export function vectorize(tags: string[], model: TfidfModel): number[] {
  if (model.terms.length === 0) return []
  const termIndex = new Map(model.terms.map((term, i) => [term, i]))
  const vector = new Array<number>(model.terms.length).fill(0)
  for (const tag of tags) {
    const i = termIndex.get(tag)
    if (i === undefined) continue
    vector[i]! += 1 // tf：重复标签计入词频
  }
  for (let i = 0; i < vector.length; i++) {
    vector[i]! *= model.idf[i]!
  }
  return vector
}

/** 余弦相似度：零向量（无标签/无权重）相似度定义为 0 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! ** 2
    normB += b[i]! ** 2
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export interface SimilarCandidate {
  id: string
  /** 候选的 TF-IDF 向量（与种子同词表） */
  vector: number[]
}

export interface RankedCandidate {
  id: string
  similarity: number
}

/** 与种子向量按余弦相似度降序排序；并列按 id 升序（确定性），不做过滤（由调用方排除已浏览等） */
export function rankBySimilarity(
  seed: number[],
  candidates: SimilarCandidate[],
): RankedCandidate[] {
  return candidates
    .map(candidate => ({ id: candidate.id, similarity: cosineSimilarity(seed, candidate.vector) }))
    .sort((x, y) => y.similarity - x.similarity || (x.id < y.id ? -1 : 1))
}
