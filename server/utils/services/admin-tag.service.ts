import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { AdminError, isRecordNotFound, isUniqueViolation } from './admin-error'
import { invalidateCraftItems } from './craft-item.service'

/**
 * 标签管理业务层（工单 #5 / 用户故事 20）：
 * 标签是推荐算法的数据源；删除时条目关联由外键级联解除。
 * 缓存接线（工单 #9 / 规格偏差 3）：标签名出现在条目详情中，
 * 重命名与删除后对关联条目逐个失效详情缓存。
 */

export interface AdminTagListQuery {
  /** 名称关键字（不区分大小写包含匹配） */
  q?: string
}

export interface AdminTagView {
  id: string
  name: string
  /** 关联的技艺条目数（删除前提示用） */
  itemCount: number
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseWriteInput(input: unknown): { name: string } {
  if (typeof input !== 'object' || input === null) {
    throw new AdminError(400, '请求体格式不正确')
  }
  const { name } = input as Record<string, unknown>
  if (!isNonEmptyString(name)) throw new AdminError(400, '标签名不能为空')
  return { name: name.trim() }
}

type TagRow = Prisma.TagGetPayload<{ include: { _count: { select: { items: true } } } }>

function toView(row: TagRow): AdminTagView {
  return { id: row.id, name: row.name, itemCount: row._count.items }
}

/** 标签列表（管理端）：附带关联条目数，支持名称搜索 */
export async function listAdminTags(query: AdminTagListQuery): Promise<{ items: AdminTagView[] }> {
  const keyword = query.q?.trim()
  const rows = await usePrisma().tag.findMany({
    where: keyword ? { name: { contains: keyword, mode: 'insensitive' } } : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  })
  return { items: rows.map(toView) }
}

/** 创建标签：重名 409 */
export async function createAdminTag(input: unknown): Promise<AdminTagView> {
  const data = parseWriteInput(input)
  try {
    const row = await usePrisma().tag.create({ data, include: { _count: { select: { items: true } } } })
    return toView(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '标签已存在')
    throw error
  }
}

/** 重命名标签：不存在 404，重名 409；成功后失效关联条目的详情缓存（详情含标签名） */
export async function updateAdminTag(id: string, input: unknown): Promise<AdminTagView> {
  const data = parseWriteInput(input)
  try {
    const row = await usePrisma().tag.update({
      where: { id },
      data,
      include: {
        _count: { select: { items: true } },
        items: { select: { craftItemId: true } },
      },
    })
    await invalidateCraftItems(row.items.map(item => item.craftItemId))
    return toView(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '标签已存在')
    if (isRecordNotFound(error)) throw new AdminError(404, '标签不存在')
    throw error
  }
}

/** 删除标签：与条目的关联由外键级联解除（craft_item_tag.onDelete: Cascade）；不存在 404；
 *  关联条目的详情缓存一并失效（否则缓存的详情仍展示已删除的标签名） */
export async function deleteAdminTag(id: string): Promise<void> {
  const linkedItemIds = (await usePrisma().craftItemTag.findMany({
    where: { tagId: id },
    select: { craftItemId: true },
  })).map(link => link.craftItemId)

  try {
    await usePrisma().tag.delete({ where: { id } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new AdminError(404, '标签不存在')
    throw error
  }
  await invalidateCraftItems(linkedItemIds)
}
