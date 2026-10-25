import type { CourseStatus, Prisma } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { isRecordNotFound } from './admin-error'
import { CourseError } from './course.service'
import { normalizePagination } from './craft-item.service'

/**
 * 课程审核业务层（管理端，工单 #6 / 用户故事 23）：
 * 与创作端（course.service）分离 —— 管理员可见全部状态课程，仅做状态迁移（发布/驳回），
 * 不修改课程内容本身。
 */

const COURSE_STATUSES = new Set<CourseStatus>(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'])

const REJECT_REASON_MAX = 500

export interface AdminCourseListQuery {
  status?: string
  page?: number
  pageSize?: number
}

export interface AdminCourseSummary {
  id: string
  title: string
  status: CourseStatus
  craftItemId: string
  craftItemName: string
  author: { id: number, username: string, displayName: string }
  stepCount: number
  rejectReason: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminCourseDetail extends AdminCourseSummary {
  intro: string
  steps: Array<{ id: string, order: number, title: string, content: string, imageUrl: string | null }>
}

/** 待审核课程列表（管理端）：支持状态筛选与分页 */
export async function listAdminCourses(
  query: AdminCourseListQuery,
): Promise<{ items: AdminCourseSummary[], total: number, page: number, pageSize: number }> {
  const db = usePrisma()
  const { page, pageSize } = normalizePagination(query.page, query.pageSize)

  let status: CourseStatus | undefined
  if (query.status !== undefined && query.status !== '') {
    if (!COURSE_STATUSES.has(query.status as CourseStatus)) throw new CourseError(400, '课程状态筛选不合法')
    status = query.status as CourseStatus
  }

  const where: Prisma.CourseWhereInput = { ...(status ? { status } : {}) }
  const [rows, total] = await Promise.all([
    db.course.findMany({
      where,
      include: {
        craftItem: { select: { name: true } },
        author: { select: { id: true, username: true, displayName: true } },
        _count: { select: { steps: true } },
      },
      orderBy: [{ updatedAt: 'desc' as const }, { id: 'asc' as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.course.count({ where }),
  ])

  return {
    items: rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      craftItemId: row.craftItemId,
      craftItemName: row.craftItem.name,
      author: row.author,
      stepCount: row._count.steps,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  }
}

/** 课程详情（管理端，审核页展示步骤内容用）：任意状态可见 */
export async function getAdminCourse(id: string): Promise<AdminCourseDetail> {
  const row = await usePrisma().course.findUnique({
    where: { id },
    include: {
      craftItem: { select: { name: true } },
      author: { select: { id: true, username: true, displayName: true } },
      steps: { orderBy: { order: 'asc' as const } },
      _count: { select: { steps: true } },
    },
  })
  if (!row) throw new CourseError(404, '课程不存在')
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    craftItemId: row.craftItemId,
    craftItemName: row.craftItem.name,
    author: row.author,
    stepCount: row._count.steps,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    intro: row.intro,
    steps: row.steps.map(step => ({
      id: step.id,
      order: step.order,
      title: step.title,
      content: step.content,
      imageUrl: step.imageUrl,
    })),
  }
}

/** 发布：仅待审核课程可发布（PENDING_REVIEW → PUBLISHED） */
export async function publishAdminCourse(id: string): Promise<AdminCourseDetail> {
  const db = usePrisma()
  const row = await db.course.findUnique({ where: { id }, select: { status: true } })
  if (!row) throw new CourseError(404, '课程不存在')
  if (row.status !== 'PENDING_REVIEW') {
    throw new CourseError(409, '仅待审核课程可发布')
  }
  try {
    await db.course.update({ where: { id }, data: { status: 'PUBLISHED' } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new CourseError(404, '课程不存在')
    throw error
  }
  return getAdminCourse(id)
}

/** 驳回：仅待审核课程可驳回（PENDING_REVIEW → REJECTED），理由可选 */
export async function rejectAdminCourse(id: string, input: unknown): Promise<AdminCourseDetail> {
  let reason: string | null = null
  if (typeof input === 'object' && input !== null && (input as { reason?: unknown }).reason !== undefined) {
    const raw = (input as { reason?: unknown }).reason
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new CourseError(400, '驳回理由需为非空文本')
    }
    if (raw.trim().length > REJECT_REASON_MAX) {
      throw new CourseError(400, `驳回理由不超过 ${REJECT_REASON_MAX} 个字符`)
    }
    reason = raw.trim()
  }

  const db = usePrisma()
  const row = await db.course.findUnique({ where: { id }, select: { status: true } })
  if (!row) throw new CourseError(404, '课程不存在')
  if (row.status !== 'PENDING_REVIEW') {
    throw new CourseError(409, '仅待审核课程可驳回')
  }
  try {
    await db.course.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new CourseError(404, '课程不存在')
    throw error
  }
  return getAdminCourse(id)
}
