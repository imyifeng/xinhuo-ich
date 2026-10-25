import { usePrisma } from '../prisma'
import { COURSE_TARGET_TYPE, recordBehaviorEvent } from './behavior-event.service'
import { CourseError, type CourseProgress } from './course.service'

/**
 * 学习进度业务层（工单 #6 / 用户故事 10-12、27）：
 * 开始课程与标记完成分别写 START_COURSE / COMPLETE_STEP 行为事件；
 * 学习进度落在 learning_record（userId + stepId 联合主键，天然幂等）。
 */

/** 确认课程已发布（对学习者可见），否则 404（不区分不存在与未发布，与条目详情一致） */
async function requirePublishedCourse(courseId: string): Promise<{ id: string }> {
  const course = await usePrisma().course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true },
  })
  if (!course || course.status !== 'PUBLISHED') {
    throw new CourseError(404, '课程不存在或未发布')
  }
  return course
}

/** 开始课程：START_COURSE 事件每课程每用户仅记一次（幂等），返回是否首次 */
export async function startCourse(userId: number, courseId: string): Promise<{ started: boolean }> {
  const course = await requirePublishedCourse(courseId)
  const existing = await usePrisma().behaviorEvent.findFirst({
    where: { userId, type: 'START_COURSE', targetType: COURSE_TARGET_TYPE, targetId: course.id },
    select: { id: true },
  })
  if (existing) return { started: false }
  await recordBehaviorEvent({ userId, type: 'START_COURSE', targetType: COURSE_TARGET_TYPE, targetId: course.id })
  return { started: true }
}

/** 标记步骤完成：learning_record 幂等落库（重复完成不重复落库/不重复记事件），返回最新进度 */
export async function completeStep(userId: number, courseId: string, stepId: string): Promise<CourseProgress> {
  const db = usePrisma()
  const step = await db.step.findFirst({
    where: { id: stepId, courseId },
    select: { id: true, course: { select: { id: true, status: true } } },
  })
  if (!step || step.course.status !== 'PUBLISHED') {
    throw new CourseError(404, '课程不存在或未发布')
  }

  const existing = await db.learningRecord.findUnique({
    where: { userId_stepId: { userId, stepId } },
    select: { stepId: true },
  })
  if (!existing) {
    try {
      await db.learningRecord.create({ data: { userId, stepId } })
      // 事件只随首次完成写一次，保证画像特征不被重复计数放大
      await recordBehaviorEvent({ userId, type: 'COMPLETE_STEP', targetType: COURSE_TARGET_TYPE, targetId: courseId })
    }
    catch (error) {
      // 并发下重复首次完成：联合主键冲突（P2002）视为已完成，不重复记事件
      if (typeof error !== 'object' || error === null || (error as { code?: string }).code !== 'P2002') {
        throw error
      }
    }
  }
  return getCourseProgress(userId, courseId)
}

/** 课程学习进度：已完成步骤数 / 总步骤数 */
export async function getCourseProgress(userId: number, courseId: string): Promise<CourseProgress> {
  const db = usePrisma()
  const [totalSteps, completedSteps] = await Promise.all([
    db.step.count({ where: { courseId } }),
    db.learningRecord.count({ where: { userId, step: { courseId } } }),
  ])
  return { completedSteps, totalSteps }
}
