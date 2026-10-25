import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'

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

/** 技艺条目详情：不存在或未发布返回 null（由接入层转 404） */
export async function getCraftItemDetail(id: string): Promise<CraftItemDetail | null> {
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
