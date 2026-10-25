import type { CourseStatus, Prisma, Role } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { isRecordNotFound } from './admin-error'

/**
 * 课程业务层（工单 #6）：传承人创作端 + 公开浏览 + 学习进度的共享底层。
 * 管理端审核（发布/驳回）见 admin-course.service.ts。
 * 错误契约：CourseError 携带语义化 HTTP 状态码，由接入层包装器映射为 { error } 响应体。
 */
export class CourseError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** 仅草稿与已驳回课程可编辑/删除（待审核与已发布需走审核流程，防止绕过审查改动内容） */
const EDITABLE_STATUSES = new Set<CourseStatus>(['DRAFT', 'REJECTED'])

const TITLE_MAX = 100
const INTRO_MAX = 2000
const CONTENT_MAX = 20000
const IMAGE_URL_MAX = 500

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** 校验并归一化课程信息入参；partial 为真时仅校验出现的字段（undefined = 不修改） */
export function parseCourseInput(input: unknown, partial = false): { title?: string, intro?: string, craftItemId?: string } {
  if (typeof input !== 'object' || input === null) {
    throw new CourseError(400, '请求体格式不正确')
  }
  const body = input as Record<string, unknown>
  const result: { title?: string, intro?: string, craftItemId?: string } = {}

  if (body.title !== undefined || !partial) {
    if (!isNonEmptyString(body.title)) throw new CourseError(400, '课程标题不能为空')
    if (body.title.trim().length > TITLE_MAX) throw new CourseError(400, `课程标题不超过 ${TITLE_MAX} 个字符`)
    result.title = body.title.trim()
  }
  if (body.intro !== undefined || !partial) {
    if (!isNonEmptyString(body.intro)) throw new CourseError(400, '课程简介不能为空')
    if (body.intro.trim().length > INTRO_MAX) throw new CourseError(400, `课程简介不超过 ${INTRO_MAX} 个字符`)
    result.intro = body.intro.trim()
  }
  if (body.craftItemId !== undefined) {
    if (!isNonEmptyString(body.craftItemId)) throw new CourseError(400, '挂载的技艺条目不合法')
    result.craftItemId = body.craftItemId.trim()
  }
  return result
}

export interface ParsedStepInput {
  title?: string
  content?: string
  imageUrl?: string | null
}

/** 校验并归一化步骤入参；imageUrl 显式传 null 表示清除配图 */
export function parseStepInput(input: unknown, partial = false): ParsedStepInput {
  if (typeof input !== 'object' || input === null) {
    throw new CourseError(400, '请求体格式不正确')
  }
  const body = input as Record<string, unknown>
  const result: ParsedStepInput = {}

  if (body.title !== undefined || !partial) {
    if (!isNonEmptyString(body.title)) throw new CourseError(400, '步骤标题不能为空')
    if (body.title.trim().length > TITLE_MAX) throw new CourseError(400, `步骤标题不超过 ${TITLE_MAX} 个字符`)
    result.title = body.title.trim()
  }
  if (body.content !== undefined || !partial) {
    if (!isNonEmptyString(body.content)) throw new CourseError(400, '步骤内容不能为空')
    if (body.content.trim().length > CONTENT_MAX) throw new CourseError(400, `步骤内容不超过 ${CONTENT_MAX} 个字符`)
    result.content = body.content.trim()
  }
  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null) {
      result.imageUrl = null
    }
    else if (isNonEmptyString(body.imageUrl) && body.imageUrl.trim().length <= IMAGE_URL_MAX) {
      result.imageUrl = body.imageUrl.trim()
    }
    else {
      throw new CourseError(400, '配图地址不合法')
    }
  }
  return result
}

/** 校验技艺条目存在（挂载目标），不存在 400 */
async function assertCraftItemExists(craftItemId: string): Promise<void> {
  const found = await usePrisma().craftItem.findUnique({ where: { id: craftItemId }, select: { id: true } })
  if (!found) throw new CourseError(400, '挂载的技艺条目不存在')
}

export interface CourseStepView {
  id: string
  order: number
  title: string
  content: string
  imageUrl: string | null
}

export interface StudioCourseSummary {
  id: string
  title: string
  intro: string
  status: CourseStatus
  craftItemId: string
  craftItemName: string
  stepCount: number
  rejectReason: string | null
  createdAt: string
  updatedAt: string
}

export interface StudioCourseDetail extends StudioCourseSummary {
  steps: CourseStepView[]
}

/** 加载课程详情（含按序步骤），组装为创作端视图 */
async function loadCourseDetail(courseId: string): Promise<StudioCourseDetail> {
  const row = await usePrisma().course.findUnique({
    where: { id: courseId },
    include: {
      craftItem: { select: { name: true } },
      steps: { orderBy: { order: 'asc' as const } },
      _count: { select: { steps: true } },
    },
  })
  if (!row) throw new CourseError(404, '课程不存在')
  return toStudioDetail(row)
}

type CourseRow = Prisma.CourseGetPayload<{
  include: { craftItem: { select: { name: true } }, steps: true, _count: { select: { steps: true } } }
}>

function toStudioDetail(row: CourseRow): StudioCourseDetail {
  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    status: row.status,
    craftItemId: row.craftItemId,
    craftItemName: row.craftItem.name,
    stepCount: row._count.steps,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    steps: row.steps.map(step => ({
      id: step.id,
      order: step.order,
      title: step.title,
      content: step.content,
      imageUrl: step.imageUrl,
    })),
  }
}

/**
 * 取得操作者可见的课程并按需校验可编辑性：
 * - 不存在 404；非作者（管理员除外）404（不泄漏他人课程存在性）
 * - 需要可编辑时，待审核/已发布课程 409
 */
async function getCourseForActor(
  actorId: number,
  actorRole: Role,
  courseId: string,
  options: { requireEditable?: boolean } = {},
): Promise<CourseRow> {
  const row = await usePrisma().course.findUnique({
    where: { id: courseId },
    include: {
      craftItem: { select: { name: true } },
      steps: { orderBy: { order: 'asc' as const } },
      _count: { select: { steps: true } },
    },
  })
  if (!row || (actorRole !== 'ADMIN' && row.authorId !== actorId)) {
    throw new CourseError(404, '课程不存在')
  }
  if (options.requireEditable && !EDITABLE_STATUSES.has(row.status)) {
    throw new CourseError(409, '当前状态不可编辑（待审核或已发布）')
  }
  return row
}

/** 创建课程（默认草稿）：挂载条目必须存在 */
export async function createStudioCourse(authorId: number, input: unknown): Promise<StudioCourseDetail> {
  const data = parseCourseInput(input)
  await assertCraftItemExists(data.craftItemId!)
  const row = await usePrisma().course.create({
    data: {
      title: data.title!,
      intro: data.intro!,
      craftItemId: data.craftItemId!,
      authorId,
      status: 'DRAFT',
    },
    include: {
      craftItem: { select: { name: true } },
      steps: true,
      _count: { select: { steps: true } },
    },
  })
  return toStudioDetail(row)
}

/** 创作端课程列表：仅本人（管理员传 actorRole=ADMIN 时也按作者过滤，无全量列表需求） */
export async function listStudioCourses(authorId: number): Promise<{ items: StudioCourseSummary[] }> {
  const rows = await usePrisma().course.findMany({
    where: { authorId },
    include: {
      craftItem: { select: { name: true } },
      _count: { select: { steps: true } },
    },
    orderBy: [{ updatedAt: 'desc' as const }, { id: 'asc' as const }],
  })
  return {
    items: rows.map(row => ({
      id: row.id,
      title: row.title,
      intro: row.intro,
      status: row.status,
      craftItemId: row.craftItemId,
      craftItemName: row.craftItem.name,
      stepCount: row._count.steps,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}

/** 创作端课程详情（本人可见全部状态；管理员代看） */
export async function getStudioCourse(actorId: number, actorRole: Role, courseId: string): Promise<StudioCourseDetail> {
  const row = await getCourseForActor(actorId, actorRole, courseId)
  return toStudioDetail(row)
}

/** 更新课程信息（部分更新语义）：仅草稿/已驳回可改 */
export async function updateStudioCourse(
  actorId: number,
  actorRole: Role,
  courseId: string,
  input: unknown,
): Promise<StudioCourseDetail> {
  const data = parseCourseInput(input, true)
  if (data.craftItemId) await assertCraftItemExists(data.craftItemId)
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })

  try {
    await usePrisma().course.update({
      where: { id: courseId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.intro !== undefined ? { intro: data.intro } : {}),
        ...(data.craftItemId !== undefined ? { craftItemId: data.craftItemId } : {}),
      },
    })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new CourseError(404, '课程不存在')
    throw error
  }
  return loadCourseDetail(courseId)
}

/** 删除课程：仅草稿/已驳回；步骤与学习记录随外键级联删除 */
export async function deleteStudioCourse(actorId: number, actorRole: Role, courseId: string): Promise<void> {
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })
  try {
    await usePrisma().course.delete({ where: { id: courseId } })
  }
  catch (error) {
    if (isRecordNotFound(error)) throw new CourseError(404, '课程不存在')
    throw error
  }
}

/** 添加步骤：追加到当前末尾（order = 最大序号 + 1） */
export async function addCourseStep(
  actorId: number,
  actorRole: Role,
  courseId: string,
  input: unknown,
): Promise<CourseStepView> {
  const data = parseStepInput(input)
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })
  const db = usePrisma()
  const last = await db.step.findFirst({
    where: { courseId },
    orderBy: { order: 'desc' as const },
    select: { order: true },
  })
  const step = await db.step.create({
    data: {
      courseId,
      order: (last?.order ?? 0) + 1,
      title: data.title!,
      content: data.content!,
      imageUrl: data.imageUrl ?? null,
    },
  })
  return { id: step.id, order: step.order, title: step.title, content: step.content, imageUrl: step.imageUrl }
}

/** 更新步骤（部分更新语义）：仅草稿/已驳回课程可改 */
export async function updateCourseStep(
  actorId: number,
  actorRole: Role,
  courseId: string,
  stepId: string,
  input: unknown,
): Promise<CourseStepView> {
  const data = parseStepInput(input, true)
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })
  const existing = await usePrisma().step.findFirst({ where: { id: stepId, courseId }, select: { id: true } })
  if (!existing) throw new CourseError(404, '步骤不存在')
  const step = await usePrisma().step.update({
    where: { id: stepId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    },
  })
  return { id: step.id, order: step.order, title: step.title, content: step.content, imageUrl: step.imageUrl }
}

/** 删除步骤：后续步骤序号前移，保持 1..n 连续 */
export async function deleteCourseStep(
  actorId: number,
  actorRole: Role,
  courseId: string,
  stepId: string,
): Promise<void> {
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })
  const db = usePrisma()
  const existing = await db.step.findFirst({ where: { id: stepId, courseId }, select: { id: true, order: true } })
  if (!existing) throw new CourseError(404, '步骤不存在')

  await db.step.delete({ where: { id: stepId } })
  await db.step.updateMany({
    where: { courseId, order: { gt: existing.order } },
    data: { order: { decrement: 1 } },
  })
}

/**
 * 提交审核：DRAFT/REJECTED → PENDING_REVIEW，需至少一个步骤，旧驳回理由被清空。
 * 待审核/已发布课程重复提交 409。
 */
export async function submitStudioCourse(actorId: number, actorRole: Role, courseId: string): Promise<StudioCourseDetail> {
  const row = await getCourseForActor(actorId, actorRole, courseId)
  if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
    throw new CourseError(409, '当前状态不可提交（仅草稿或已驳回可提交）')
  }
  if (row._count.steps === 0) {
    throw new CourseError(400, '请先添加至少一个步骤再提交审核')
  }
  await usePrisma().course.update({
    where: { id: courseId },
    data: { status: 'PENDING_REVIEW', rejectReason: null },
  })
  return loadCourseDetail(courseId)
}

/**
 * 重排步骤：入参为该课程全部步骤 ID 的目标顺序（全量语义，缺一/多一/重复均 400）。
 * 两阶段写入避开 (courseId, order) 唯一约束：先整体挪到负数区，再落最终序号。
 */
export async function reorderCourseSteps(
  actorId: number,
  actorRole: Role,
  courseId: string,
  input: unknown,
): Promise<StudioCourseDetail> {
  await getCourseForActor(actorId, actorRole, courseId, { requireEditable: true })
  const db = usePrisma()
  const current = await db.step.findMany({ where: { courseId }, select: { id: true } })
  const currentIds = new Set(current.map(s => s.id))

  if (typeof input !== 'object' || input === null || !Array.isArray((input as { stepIds?: unknown }).stepIds)) {
    throw new CourseError(400, 'stepIds 需为字符串数组')
  }
  const stepIds = (input as { stepIds: unknown[] }).stepIds
  if (stepIds.some(id => typeof id !== 'string') || stepIds.length !== currentIds.size
    || new Set(stepIds as string[]).size !== stepIds.length) {
    throw new CourseError(400, 'stepIds 需为课程全部步骤 ID 的完整去重列表')
  }

  await db.$transaction(async (tx) => {
    for (const [index, id] of (stepIds as string[]).entries()) {
      if (!currentIds.has(id)) throw new CourseError(400, 'stepIds 包含不属于本课程的步骤')
      await tx.step.update({ where: { id }, data: { order: -(index + 1) } })
    }
    for (const [index, id] of (stepIds as string[]).entries()) {
      await tx.step.update({ where: { id }, data: { order: index + 1 } })
    }
  })
  return loadCourseDetail(courseId)
}

// ---- 公开浏览（学习者/游客，工单 #6）----

export interface PublicCourseSummary {
  id: string
  title: string
  intro: string
  craftItemId: string
  craftItemName: string
  subcategory: string
  stepCount: number
  createdAt: string
}

/** 已发布课程列表（前台）：可按技艺条目筛选，最新在前（首页/条目页「相关课程」共用） */
export async function listPublishedCourses(query: { craftItemId?: string } = {}): Promise<{ items: PublicCourseSummary[] }> {
  const craftItemId = query.craftItemId?.trim()
  const rows = await usePrisma().course.findMany({
    where: {
      status: 'PUBLISHED',
      ...(craftItemId ? { craftItemId } : {}),
    },
    include: { craftItem: { select: { name: true, subcategory: true } }, _count: { select: { steps: true } } },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
  })
  return {
    items: rows.map(row => ({
      id: row.id,
      title: row.title,
      intro: row.intro,
      craftItemId: row.craftItemId,
      craftItemName: row.craftItem.name,
      subcategory: row.craftItem.subcategory,
      stepCount: row._count.steps,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export interface PublicCourseStep {
  id: string
  order: number
  title: string
  /** 游客仅预览大纲（用户故事 4），content 为 null；登录后返回全文 */
  content: string | null
  imageUrl: string | null
  /** 仅登录用户返回：该步骤是否已完成 */
  completed?: boolean
}

export interface CourseProgress {
  completedSteps: number
  totalSteps: number
}

export interface PublicCourseDetail {
  id: string
  title: string
  intro: string
  craftItem: { id: string, name: string, subcategory: string }
  steps: PublicCourseStep[]
  /** 仅登录用户返回学习进度（GLOSSARY：已完成步骤占比的分子分母） */
  progress: CourseProgress | null
}

/** 已发布课程详情：游客见大纲（无 content / progress），登录用户见全文与进度 */
export async function getPublishedCourseDetail(courseId: string, viewerUserId?: number | null): Promise<PublicCourseDetail | null> {
  const loggedIn = viewerUserId != null
  const row = await usePrisma().course.findUnique({
    where: { id: courseId },
    include: {
      craftItem: { select: { id: true, name: true, subcategory: true } },
      steps: {
        orderBy: { order: 'asc' as const },
        include: { learningRecords: { where: { userId: viewerUserId ?? -1 }, select: { stepId: true } } },
      },
    },
  })
  if (!row || row.status !== 'PUBLISHED') return null

  const completedSteps = loggedIn ? row.steps.filter(s => s.learningRecords.length > 0).length : 0
  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    craftItem: row.craftItem,
    steps: row.steps.map(step => ({
      id: step.id,
      order: step.order,
      title: step.title,
      content: loggedIn ? step.content : null,
      imageUrl: step.imageUrl,
      ...(loggedIn ? { completed: step.learningRecords.length > 0 } : {}),
    })),
    progress: loggedIn ? { completedSteps, totalSteps: row.steps.length } : null,
  }
}

/** 我的课程进度（学习者端）：有完成记录的已发布课程，按最近完成时间倒序 */
export async function listMyCourseProgress(userId: number): Promise<{ items: Array<MyCourseProgress> }> {
  const rows = await usePrisma().course.findMany({
    where: {
      status: 'PUBLISHED',
      steps: { some: { learningRecords: { some: { userId } } } },
    },
    include: {
      craftItem: { select: { name: true } },
      steps: { select: { learningRecords: { where: { userId }, select: { completedAt: true } } } },
    },
  })

  const items = rows.map((row) => {
    const completed = row.steps.filter(s => s.learningRecords.length > 0)
    const lastCompletedAt = completed
      .flatMap(s => s.learningRecords.map(r => r.completedAt))
      .sort((a, b) => b.getTime() - a.getTime())[0]
    return {
      courseId: row.id,
      title: row.title,
      craftItemId: row.craftItemId,
      craftItemName: row.craftItem.name,
      completedSteps: completed.length,
      totalSteps: row.steps.length,
      lastCompletedAt: lastCompletedAt ? lastCompletedAt.toISOString() : null,
    }
  }).sort((a, b) => (b.lastCompletedAt ?? '').localeCompare(a.lastCompletedAt ?? ''))

  return { items }
}

export interface MyCourseProgress {
  courseId: string
  title: string
  craftItemId: string
  craftItemName: string
  completedSteps: number
  totalSteps: number
  lastCompletedAt: string | null
}
