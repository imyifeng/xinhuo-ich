import type { Prisma, Role } from '../../generated/prisma/client'
import { toPublicUser } from './auth.service'
import type { PublicUser } from './auth.service'
import { usePrisma } from '../prisma'
import { AdminError } from './admin-error'

/**
 * 账号管理业务层（工单 #5 / 用户故事 22）：账号列表 + 角色标记。
 * 角色语义见 GLOSSARY：学习者（LEARNER）/ 传承人（INHERITOR）/ 管理员（ADMIN），
 * 传承人由管理员线下核实后标记，无线上自助认证。
 */

export const USER_ROLES: readonly Role[] = ['LEARNER', 'INHERITOR', 'ADMIN'] as const

export interface AdminUserListQuery {
  /** 用户名/昵称关键字（不区分大小写包含匹配） */
  q?: string
  /** 角色筛选 */
  role?: string
  page?: number
  pageSize?: number
}

export interface AdminUserListResult {
  items: PublicUser[]
  total: number
  page: number
  pageSize: number
}

const USER_PAGE_SIZE_MAX = 100
const USER_PAGE_SIZE_DEFAULT = 20

function normalizePagination(page?: unknown, pageSize?: unknown) {
  const pageNum = Number.parseInt(String(page ?? ''), 10)
  const pageSizeNum = Number.parseInt(String(pageSize ?? ''), 10)
  return {
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: Number.isFinite(pageSizeNum)
      ? Math.min(Math.max(pageSizeNum, 1), USER_PAGE_SIZE_MAX)
      : USER_PAGE_SIZE_DEFAULT,
  }
}

function parseRoleFilter(role?: string): Role | undefined {
  if (role === undefined || role === '') return undefined
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new AdminError(400, '角色筛选不合法')
  }
  return role as Role
}

/** 账号列表（管理端）：用户名/昵称搜索 + 角色筛选 + 分页；passwordHash 永不出库 */
export async function listAdminUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)
  const keyword = query.q?.trim()
  const role = parseRoleFilter(query.role)

  const where: Prisma.UserWhereInput = {
    ...(keyword
      ? {
          OR: [
            { username: { contains: keyword, mode: 'insensitive' } },
            { displayName: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ])

  return { items: rows.map(toPublicUser), total, page, pageSize }
}

/** 角色标记（学习者 ↔ 传承人 ↔ 管理员）：角色以数据库为准，管理员调整后对既有会话立即生效 */
export async function updateUserRole(id: number, input: unknown): Promise<PublicUser> {
  if (typeof input !== 'object' || input === null) {
    throw new AdminError(400, '请求体格式不正确')
  }
  const { role } = input as Record<string, unknown>
  if (typeof role !== 'string' || !(USER_ROLES as readonly string[]).includes(role)) {
    throw new AdminError(400, '角色不合法')
  }

  let user
  try {
    user = await usePrisma().user.update({
      where: { id },
      data: { role: role as Role },
    })
  }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      throw new AdminError(404, '账号不存在')
    }
    throw error
  }
  return toPublicUser(user)
}
