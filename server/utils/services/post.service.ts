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

export interface CommentView {
  id: string
  content: string
  author: PostAuthorView
  createdAt: string
}

export interface PostDetail {
  id: string
  title: string
  content: string
  author: PostAuthorView
  /** 可见评论（下架评论不出现在详情中），按创建时间正序 */
  comments: CommentView[]
  createdAt: string
}

/** 帖子详情（公开）：不存在或已下架返回 null（由接入层转 404） */
export async function getPostDetail(id: string): Promise<PostDetail | null> {
  const db = usePrisma()
  const row = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      createdAt: true,
      author: { select: { id: true, displayName: true } },
      comments: {
        where: { status: 'VISIBLE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, displayName: true } },
        },
      },
    },
  })
  if (!row || row.status !== 'VISIBLE') return null

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: { id: row.author.id, displayName: row.author.displayName },
    comments: row.comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      author: { id: comment.author.id, displayName: comment.author.displayName },
      createdAt: comment.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
  }
}
