import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { useRedis } from '../redis'
import { cacheAside, type CacheOutcome } from './cache.service'
import { recordBehaviorEvent } from './behavior-event.service'

/** 列表页默认与上限：无翻页器时每页 12 条，防大分页拖垮查询 */
export const CRAFT_ITEM_PAGE_SIZE_DEFAULT = 12
export const CRAFT_ITEM_PAGE_SIZE_MAX = 50

export interface CraftItemListQuery {
  /** 子类别精确筛选；空串/undefined 表示不筛选 */
  subcategory?: string
  page?: number
  pageSize?: number
}

export interface CraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  code: string
  /** 图集 {url, credit}[]，列表页取首图作封面 */
  images: Array<{ url: string, credit: string }>
  tags: string[]
}

export interface CraftItemListResult {
  items: CraftListItem[]
  total: number
  page: number
  pageSize: number
  /** 全部已发布条目的去重子类别（供筛选芯片，不随筛选变化） */
  subcategories: string[]
}

/** 归一化分页参数：page 从 1 起，pageSize 夹在 [1, 50] */
export function normalizePagination(page?: unknown, pageSize?: unknown) {
  const pageNum = Number.parseInt(String(page ?? ''), 10)
  const pageSizeNum = Number.parseInt(String(pageSize ?? ''), 10)
  return {
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: Number.isFinite(pageSizeNum)
      ? Math.min(Math.max(pageSizeNum, 1), CRAFT_ITEM_PAGE_SIZE_MAX)
      : CRAFT_ITEM_PAGE_SIZE_DEFAULT,
  }
}

/** 技艺条目列表：仅已发布，支持子类别筛选与分页 */
export async function listCraftItems(query: CraftItemListQuery): Promise<CraftItemListResult> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)
  const subcategory = query.subcategory?.trim()

  const where: Prisma.CraftItemWhereInput = {
    status: 'PUBLISHED',
    ...(subcategory ? { subcategory } : {}),
  }

  const [rows, total, subcategoryRows] = await Promise.all([
    db.craftItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        subcategory: true,
        region: true,
        batch: true,
        code: true,
        images: true,
        tags: { orderBy: { tag: { name: 'asc' as const } }, select: { tag: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.craftItem.count({ where }),
    db.craftItem.findMany({
      where: { status: 'PUBLISHED' },
      select: { subcategory: true },
      distinct: ['subcategory'],
      orderBy: { subcategory: 'asc' },
    }),
  ])

  const items: CraftListItem[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    subcategory: row.subcategory,
    region: row.region,
    batch: row.batch,
    code: row.code,
    images: asImageList(row.images),
    tags: row.tags.map(t => t.tag.name),
  }))

  return { items, total, page, pageSize, subcategories: subcategoryRows.map(r => r.subcategory) }
}

/** images 字段存的是 {url, credit} 数组，容错非数组脏数据 */
export function asImageList(value: Prisma.JsonValue | null): Array<{ url: string, credit: string }> {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is { url: string, credit: string } =>
    typeof entry === 'object' && entry !== null && typeof (entry as { url?: unknown }).url === 'string',
  )
}

export interface InheritorView {
  id: string
  name: string
  level: string
  bio: string
}

export interface CraftItemDetail {
  id: string
  name: string
  subcategory: string
  batch: string
  code: string
  region: string
  history: string
  features: string
  images: Array<{ url: string, credit: string }>
  videoUrl: string | null
  tags: string[]
  inheritors: InheritorView[]
}

/** 详情缓存 TTL：命中 60s 基础（写入时由缓存层附加随机抖动防雪崩）；
 *  空值 10s（防穿透：不存在的条目 ID 短期内不再回源，条目新建后最多 10s 可见） */
export const CRAFT_ITEM_DETAIL_TTL_MS = 60_000
export const CRAFT_ITEM_DETAIL_NULL_TTL_MS = 10_000

/** 详情缓存键（管理端失效与测试辅助均复用此命名） */
export function craftItemDetailCacheKey(id: string): string {
  return `cache:craft-item:detail:${id}`
}

/** 数据变更失效（cache-aside 写路径）：管理端更新/删除条目后调用，清除详情缓存键。
 *  失效失败仅记日志不抛出——缓存不一致可由短 TTL 兜底，不应拖垮管理端写入。
 *  接线说明：admin API 由 T4 并行开发，合入后在条目更新/删除写路径调用本函数。 */
export async function invalidateCraftItem(id: string): Promise<void> {
  try {
    await useRedis().del(craftItemDetailCacheKey(id))
  }
  catch (err) {
    console.error('[cache] 清除技艺条目详情缓存失败', id, err instanceof Error ? err.message : err)
  }
}

/** 批量失效（间接变更用）：管理端改标签/传承人等会影响多个条目的详情内容，
 *  对受影响条目逐个失效；逐键容错，单键失败不影响其余键 */
export async function invalidateCraftItems(ids: readonly string[]): Promise<void> {
  for (const id of new Set(ids)) {
    await invalidateCraftItem(id)
  }
}

export interface CraftItemDetailResult {
  detail: CraftItemDetail | null
  /** 缓存路径结果，供接入层设置 X-Cache 响应头（HIT | MISS | BYPASS） */
  cache: CacheOutcome
}

/** 技艺条目详情（cache-aside）：不存在或未发布返回 null（由接入层转 404）；
 *  viewerUserId 为登录用户时记录一条 VIEW_ITEM 事件，游客（null）不记。
 *  事件记录在缓存之外逐请求执行：缓存命中也照常落事件，浏览行为不因缓存丢失。 */
export async function getCraftItemDetail(id: string, viewerUserId?: number | null): Promise<CraftItemDetailResult> {
  const { value, outcome } = await cacheAside<CraftItemDetail>({
    key: craftItemDetailCacheKey(id),
    ttlMs: CRAFT_ITEM_DETAIL_TTL_MS,
    nullTtlMs: CRAFT_ITEM_DETAIL_NULL_TTL_MS,
    loader: () => loadCraftItemDetail(id),
  })
  if (value && viewerUserId != null) {
    await recordBehaviorEvent({ userId: viewerUserId, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: value.id })
  }
  return { detail: value, cache: outcome }
}

/** 纯数据访问：详情查询与展示字段组装（无副作用，缓存回源的目标函数） */
async function loadCraftItemDetail(id: string): Promise<CraftItemDetail | null> {
  const db = usePrisma()
  const row = await db.craftItem.findUnique({
    where: { id },
    include: {
      tags: { orderBy: { tag: { name: 'asc' as const } }, select: { tag: { select: { name: true } } } },
      inheritors: { orderBy: [{ level: 'asc' as const }, { name: 'asc' as const }] },
    },
  })
  if (!row || row.status !== 'PUBLISHED') return null

  return {
    id: row.id,
    name: row.name,
    subcategory: row.subcategory,
    batch: row.batch,
    code: row.code,
    region: row.region,
    history: row.history,
    features: row.features,
    images: asImageList(row.images),
    videoUrl: row.videoUrl,
    tags: row.tags.map(t => t.tag.name),
    inheritors: row.inheritors.map(inheritor => ({
      id: inheritor.id,
      name: inheritor.name,
      level: inheritor.level,
      bio: inheritor.bio,
    })),
  }
}
