import type { CraftItem, CraftItemStatus, Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { AdminError, isRecordNotFound, isUniqueViolation } from './admin-error'
import { asImageList, invalidateCraftItem, normalizePagination } from './craft-item.service'

/**
 * 技艺条目管理业务层（工单 #5 / 用户故事 19-20）：
 * 与公开展示层（craft-item.service）分离 —— 管理端可见未发布条目，
 * 并支持完整 CRUD、标签关联维护与图集数组维护。
 */

const CRAFT_ITEM_STATUSES = new Set(['DRAFT', 'PUBLISHED'])

/** 必填文本字段与中文标签（400 文案同时是 API 对外契约的一部分） */
const REQUIRED_FIELDS = [
  ['name', '名称'],
  ['subcategory', '子类别'],
  ['batch', '批次'],
  ['code', '编号'],
  ['region', '申报地区'],
  ['history', '历史渊源'],
  ['features', '工艺特色'],
] as const

export interface AdminCraftItemListQuery {
  status?: string
  subcategory?: string
  /** 名称关键字（不区分大小写包含匹配） */
  q?: string
  page?: number
  pageSize?: number
}

export interface AdminCraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  code: string
  status: CraftItemStatus
  tags: string[]
  inheritorCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminCraftItemDetail {
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
  status: CraftItemStatus
  /** 关联标签 ID（编辑表单回显用） */
  tagIds: string[]
}

interface CraftItemWriteData {
  name: string
  subcategory: string
  batch: string
  code: string
  region: string
  history: string
  features: string
  images: Array<{ url: string, credit: string }>
  videoUrl: string | null
  status: CraftItemStatus
  tagIds: string[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseImages(value: unknown): Array<{ url: string, credit: string }> {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new AdminError(400, '图集需为数组')
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new AdminError(400, '图集元素格式不正确')
    const { url, credit } = entry as { url?: unknown, credit?: unknown }
    if (!isNonEmptyString(url)) throw new AdminError(400, '图集元素的图片地址不能为空')
    return { url: url.trim(), credit: typeof credit === 'string' ? credit.trim() : '' }
  })
}

function parseTagIds(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new AdminError(400, 'tagIds 需为非空字符串数组')
  }
  return [...new Set(value as string[])]
}

/** 校验并归一化写入入参（创建与更新共用一套字段契约；更新为整体替换语义） */
function parseWriteInput(input: unknown): CraftItemWriteData {
  if (typeof input !== 'object' || input === null) {
    throw new AdminError(400, '请求体格式不正确')
  }
  const body = input as Record<string, unknown>

  for (const [field, label] of REQUIRED_FIELDS) {
    if (!isNonEmptyString(body[field])) {
      throw new AdminError(400, `${label}不能为空`)
    }
  }

  const status = body.status === undefined ? 'PUBLISHED' : body.status
  if (typeof status !== 'string' || !CRAFT_ITEM_STATUSES.has(status)) {
    throw new AdminError(400, '发布状态不合法')
  }

  let videoUrl: string | null = null
  if (body.videoUrl !== undefined && body.videoUrl !== null) {
    if (!isNonEmptyString(body.videoUrl)) throw new AdminError(400, '视频外链不合法')
    videoUrl = body.videoUrl.trim()
  }

  return {
    name: (body.name as string).trim(),
    subcategory: (body.subcategory as string).trim(),
    batch: (body.batch as string).trim(),
    code: (body.code as string).trim(),
    region: (body.region as string).trim(),
    history: (body.history as string).trim(),
    features: (body.features as string).trim(),
    images: parseImages(body.images),
    videoUrl,
    status: status as CraftItemStatus,
    tagIds: parseTagIds(body.tagIds),
  }
}

/** 校验 tagIds 均指向存在的标签，防止悬空关联 */
async function assertTagsExist(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return
  const found = await usePrisma().tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } })
  if (found.length !== tagIds.length) {
    throw new AdminError(400, '包含不存在的标签')
  }
}

function toDetail(row: CraftItem & { tags: Array<{ tagId: string }> }): AdminCraftItemDetail {
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
    status: row.status,
    tagIds: row.tags.map(t => t.tagId),
  }
}

/** 技艺条目列表（管理端）：含未发布，支持状态/子类别筛选与名称搜索 */
export async function listAdminCraftItems(
  query: AdminCraftItemListQuery,
): Promise<{ items: AdminCraftListItem[], total: number, page: number, pageSize: number }> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)

  let status: CraftItemStatus | undefined
  if (query.status !== undefined && query.status !== '') {
    if (!CRAFT_ITEM_STATUSES.has(query.status)) throw new AdminError(400, '发布状态筛选不合法')
    status = query.status as CraftItemStatus
  }
  const subcategory = query.subcategory?.trim()
  const keyword = query.q?.trim()

  const where: Prisma.CraftItemWhereInput = {
    ...(status ? { status } : {}),
    ...(subcategory ? { subcategory } : {}),
    ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
  }

  const [rows, total] = await Promise.all([
    db.craftItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        subcategory: true,
        region: true,
        batch: true,
        code: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tags: { orderBy: { tag: { name: 'asc' as const } }, select: { tag: { select: { name: true } } } },
        _count: { select: { inheritors: true } },
      },
      orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.craftItem.count({ where }),
  ])

  const items: AdminCraftListItem[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    subcategory: row.subcategory,
    region: row.region,
    batch: row.batch,
    code: row.code,
    status: row.status,
    tags: row.tags.map(t => t.tag.name),
    inheritorCount: row._count.inheritors,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))

  return { items, total, page, pageSize }
}

/** 条目详情（管理端，编辑表单回显用）：不存在抛 404 */
export async function getAdminCraftItem(id: string): Promise<AdminCraftItemDetail> {
  const row = await usePrisma().craftItem.findUnique({
    where: { id },
    include: { tags: { select: { tagId: true } } },
  })
  if (!row) throw new AdminError(404, '技艺条目不存在')
  return toDetail(row)
}

/** 创建条目：名称唯一冲突 409，含不存在标签 400 */
export async function createAdminCraftItem(input: unknown): Promise<AdminCraftItemDetail> {
  const data = parseWriteInput(input)
  await assertTagsExist(data.tagIds)
  const db = usePrisma()
  try {
    const row = await db.craftItem.create({
      data: {
        name: data.name,
        subcategory: data.subcategory,
        batch: data.batch,
        code: data.code,
        region: data.region,
        history: data.history,
        features: data.features,
        images: data.images,
        videoUrl: data.videoUrl,
        status: data.status,
        tags: { create: data.tagIds.map(tagId => ({ tagId })) },
      },
      include: { tags: { select: { tagId: true } } },
    })
    return toDetail(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '条目名称已存在')
    throw error
  }
}

/** 更新条目（整体替换语义，含标签关联替换）：不存在 404，名称冲突 409；
 *  成功后失效详情缓存（工单 #9 接线：状态切换/字段变更立即对公网可见） */
export async function updateAdminCraftItem(id: string, input: unknown): Promise<AdminCraftItemDetail> {
  const data = parseWriteInput(input)
  await assertTagsExist(data.tagIds)
  const db = usePrisma()
  try {
    const row = await db.craftItem.update({
      where: { id },
      data: {
        name: data.name,
        subcategory: data.subcategory,
        batch: data.batch,
        code: data.code,
        region: data.region,
        history: data.history,
        features: data.features,
        images: data.images,
        videoUrl: data.videoUrl,
        status: data.status,
        // 显式多对多（CraftItemTag）：先清空本条目关联再按入参重建，实现整体替换
        tags: {
          deleteMany: {},
          create: data.tagIds.map(tagId => ({ tagId })),
        },
      },
      include: { tags: { select: { tagId: true } } },
    })
    await invalidateCraftItem(row.id)
    return toDetail(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '条目名称已存在')
    if (isRecordNotFound(error)) throw new AdminError(404, '技艺条目不存在')
    throw error
  }
}

/** 删除条目：传承人与条目标签由外键级联解除；不存在 404；成功后失效详情缓存（公网随即 404） */
export async function deleteAdminCraftItem(id: string): Promise<void> {
  try {
    await usePrisma().craftItem.delete({ where: { id } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new AdminError(404, '技艺条目不存在')
    throw error
  }
  await invalidateCraftItem(id)
}
