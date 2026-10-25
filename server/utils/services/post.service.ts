import type { Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'

/**
 * 交流区业务层（工单 #7 / 用户故事 7~9、24）：帖子与评论的公开浏览与登录写入。
 * 术语见 GLOSSARY：帖子（Post）、评论（Comment）；管理员下架即 HIDDEN（ContentStatus）。
 */

/** 列表页默认与上限：与技艺条目一致的防大分页策略 */
export const POST_PAGE_SIZE_DEFAULT = 10
export const POST_PAGE_SIZE_MAX = 50

export interface PostAuthorView {
  id: number
  displayName: string
}

export interface PostListItem {
  id: string
  title: string
  author: PostAuthorView
  /** 可见评论数（下架评论不计） */
  commentCount: number
  createdAt: string
}

export interface PostListResult {
  items: PostListItem[]
  total: number
  page: number
  pageSize: number
}

/** 归一化分页参数：page 从 1 起，pageSize 夹在 [1, 50] */
function normalizePagination(page?: unknown, pageSize?: unknown) {
  const pageNum = Number.parseInt(String(page ?? ''), 10)
  const pageSizeNum = Number.parseInt(String(pageSize ?? ''), 10)
  return {
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: Number.isFinite(pageSizeNum)
      ? Math.min(Math.max(pageSizeNum, 1), POST_PAGE_SIZE_MAX)
      : POST_PAGE_SIZE_DEFAULT,
  }
}

/** 交流区帖子列表（公开）：仅 VISIBLE，按创建时间倒序，含作者昵称与可见评论数 */
export async function listPosts(query: { page?: number, pageSize?: number }): Promise<PostListResult> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)
  const where: Prisma.PostWhereInput = { status: 'VISIBLE' }

  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      select: {
        id: true,
        title: true,
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

  const items: PostListItem[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    author: { id: row.author.id, displayName: row.author.displayName },
    commentCount: row._count.comments,
    createdAt: row.createdAt.toISOString(),
  }))

  return { items, total, page, pageSize }
}
