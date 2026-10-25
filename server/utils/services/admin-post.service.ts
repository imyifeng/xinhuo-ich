import type { ContentStatus, Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { AdminError, isRecordNotFound } from './admin-error'

/**
 * 交流区内容审核业务层（工单 #7 / 用户故事 24）：帖子与评论的下架（HIDDEN）与恢复（VISIBLE）。
 * 下架的帖子对前台完全不可见（列表/详情/评论数），评论同理。
 */

export const CONTENT_STATUSES: readonly ContentStatus[] = ['VISIBLE', 'HIDDEN'] as const

const MOD_PAGE_SIZE_MAX = 100
const MOD_PAGE_SIZE_DEFAULT = 20

function normalizePagination(page?: unknown, pageSize?: unknown) {
  const pageNum = Number.parseInt(String(page ?? ''), 10)
  const pageSizeNum = Number.parseInt(String(pageSize ?? ''), 10)
  return {
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: Number.isFinite(pageSizeNum)
      ? Math.min(Math.max(pageSizeNum, 1), MOD_PAGE_SIZE_MAX)
      : MOD_PAGE_SIZE_DEFAULT,
  }
}

function parseStatusFilter(status?: string): ContentStatus | undefined {
  if (status === undefined || status === '') return undefined
  if (!(CONTENT_STATUSES as readonly string[]).includes(status)) {
    throw new AdminError(400, '状态筛选不合法')
  }
  return status as ContentStatus
}

export interface AdminPostListQuery {
  status?: string
  page?: number
  pageSize?: number
}

export interface AdminPostRow {
  id: string
  title: string
  author: { id: number, displayName: string }
  status: ContentStatus
  commentCount: number
  createdAt: string
}

export interface AdminPostListResult {
  items: AdminPostRow[]
  total: number
  page: number
  pageSize: number
}

/** 帖子列表（管理端）：含已下架，可按状态筛选与分页 */
export async function listAdminPosts(query: AdminPostListQuery): Promise<AdminPostListResult> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)
  const status = parseStatusFilter(query.status)

  const where: Prisma.PostWhereInput = status ? { status } : {}
  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        _count: { select: { comments: { where: { status: 'VISIBLE' } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.post.count({ where }),
  ])

  const items: AdminPostRow[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    author: { id: row.author.id, displayName: row.author.displayName },
    status: row.status,
    commentCount: row._count.comments,
    createdAt: row.createdAt.toISOString(),
  }))
  return { items, total, page, pageSize }
}

/** 下架/恢复帖子：status ∈ {VISIBLE, HIDDEN}；帖子不存在 404 */
export async function setPostStatus(id: string, input: unknown): Promise<AdminPostRow> {
  const status = parseStatusFromBody(input)
  try {
    const row = await usePrisma().post.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        _count: { select: { comments: { where: { status: 'VISIBLE' } } } },
      },
    })
    return {
      id: row.id,
      title: row.title,
      author: { id: row.author.id, displayName: row.author.displayName },
      status: row.status,
      commentCount: row._count.comments,
      createdAt: row.createdAt.toISOString(),
    }
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new AdminError(404, '帖子不存在')
    throw error
  }
}

export interface AdminCommentListQuery {
  status?: string
  /** 仅看某帖子下的评论 */
  postId?: string
  page?: number
  pageSize?: number
}

export interface AdminCommentRow {
  id: string
  content: string
  author: { id: number, displayName: string }
  post: { id: string, title: string }
  status: ContentStatus
  createdAt: string
}

export interface AdminCommentListResult {
  items: AdminCommentRow[]
  total: number
  page: number
  pageSize: number
}

/** 评论列表（管理端）：含已下架，可按状态/帖子筛选与分页 */
export async function listAdminComments(query: AdminCommentListQuery): Promise<AdminCommentListResult> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)
  const status = parseStatusFilter(query.status)

  const where: Prisma.CommentWhereInput = {
    ...(status ? { status } : {}),
    ...(query.postId ? { postId: query.postId } : {}),
  }
  const [rows, total] = await Promise.all([
    db.comment.findMany({
      where,
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        post: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.comment.count({ where }),
  ])

  const items: AdminCommentRow[] = rows.map(row => ({
    id: row.id,
    content: row.content,
    author: { id: row.author.id, displayName: row.author.displayName },
    post: { id: row.post.id, title: row.post.title },
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }))
  return { items, total, page, pageSize }
}

/** 下架/恢复评论：status ∈ {VISIBLE, HIDDEN}；评论不存在 404 */
export async function setCommentStatus(id: string, input: unknown): Promise<AdminCommentRow> {
  const status = parseStatusFromBody(input)
  try {
    const row = await usePrisma().comment.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        post: { select: { id: true, title: true } },
      },
    })
    return {
      id: row.id,
      content: row.content,
      author: { id: row.author.id, displayName: row.author.displayName },
      post: { id: row.post.id, title: row.post.title },
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new AdminError(404, '评论不存在')
    throw error
  }
}

function parseStatusFromBody(input: unknown): ContentStatus {
  if (typeof input !== 'object' || input === null) {
    throw new AdminError(400, '请求体格式不正确')
  }
  const { status } = input as Record<string, unknown>
  if (typeof status !== 'string' || !(CONTENT_STATUSES as readonly string[]).includes(status)) {
    throw new AdminError(400, '状态不合法')
  }
  return status as ContentStatus
}
