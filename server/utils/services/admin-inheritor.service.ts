import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { AdminError, isRecordNotFound, isUniqueViolation } from './admin-error'

/**
 * 传承人管理业务层（工单 #5 / 用户故事 21）：
 * 传承人作为展示人物实体挂在技艺条目下（同条目内姓名唯一），管理员完整增删改查。
 */

export interface AdminInheritorListQuery {
  /** 按所属条目筛选；空串/undefined 表示不筛选 */
  craftItemId?: string
}

export interface AdminInheritorView {
  id: string
  name: string
  level: string
  bio: string
  craftItemId: string
  craftItemName: string
}

interface InheritorWriteData {
  name: string
  level: string
  bio: string
  craftItemId: string
}

const REQUIRED_FIELDS = [
  ['name', '姓名'],
  ['level', '级别'],
  ['bio', '简介'],
  ['craftItemId', '所属技艺条目'],
] as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseWriteInput(input: unknown): InheritorWriteData {
  if (typeof input !== 'object' || input === null) {
    throw new AdminError(400, '请求体格式不正确')
  }
  const body = input as Record<string, unknown>
  for (const [field, label] of REQUIRED_FIELDS) {
    if (!isNonEmptyString(body[field])) {
      throw new AdminError(400, `${label}不能为空`)
    }
  }
  return {
    name: (body.name as string).trim(),
    level: (body.level as string).trim(),
    bio: (body.bio as string).trim(),
    craftItemId: (body.craftItemId as string).trim(),
  }
}

/** 校验所属条目存在（请求体引用的资源，语义上属 400 而非 404） */
async function assertCraftItemExists(craftItemId: string): Promise<void> {
  const item = await usePrisma().craftItem.findUnique({ where: { id: craftItemId }, select: { id: true } })
  if (!item) throw new AdminError(400, '所属技艺条目不存在')
}

/** 传承人列表（管理端）：可按所属条目筛选，附带条目名称 */
export async function listAdminInheritors(
  query: AdminInheritorListQuery,
): Promise<{ items: AdminInheritorView[] }> {
  const craftItemId = query.craftItemId?.trim()
  const rows = await usePrisma().inheritor.findMany({
    where: craftItemId ? { craftItemId } : undefined,
    include: { craftItem: { select: { name: true } } },
    orderBy: [{ craftItemId: 'asc' }, { name: 'asc' }],
  })
  return {
    items: rows.map(row => ({
      id: row.id,
      name: row.name,
      level: row.level,
      bio: row.bio,
      craftItemId: row.craftItemId,
      craftItemName: row.craftItem.name,
    })),
  }
}

/** 创建传承人：所属条目不存在 400，同条目重名 409 */
export async function createAdminInheritor(input: unknown): Promise<AdminInheritorView> {
  const data = parseWriteInput(input)
  await assertCraftItemExists(data.craftItemId)
  const db = usePrisma()
  try {
    const row = await db.inheritor.create({
      data,
      include: { craftItem: { select: { name: true } } },
    })
    return toView(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '该条目下已存在同名传承人')
    throw error
  }
}

/** 更新传承人（可改挂条目）：不存在 404，所属条目不存在 400，同条目重名 409 */
export async function updateAdminInheritor(id: string, input: unknown): Promise<AdminInheritorView> {
  const data = parseWriteInput(input)
  await assertCraftItemExists(data.craftItemId)
  const db = usePrisma()
  try {
    const row = await db.inheritor.update({
      where: { id },
      data,
      include: { craftItem: { select: { name: true } } },
    })
    return toView(row)
  }
  catch (error) {
    if (isUniqueViolation(error)) throw new AdminError(409, '该条目下已存在同名传承人')
    if (isRecordNotFound(error)) throw new AdminError(404, '传承人不存在')
    throw error
  }
}

/** 删除传承人：不存在 404 */
export async function deleteAdminInheritor(id: string): Promise<void> {
  try {
    await usePrisma().inheritor.delete({ where: { id } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new AdminError(404, '传承人不存在')
    throw error
  }
}

type InheritorRow = Prisma.InheritorGetPayload<{ include: { craftItem: { select: { name: true } } } }>

function toView(row: InheritorRow): AdminInheritorView {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    bio: row.bio,
    craftItemId: row.craftItemId,
    craftItemName: row.craftItem.name,
  }
}
