import { deleteCourseStep } from '../../../../../../utils/services/course.service'

/** 删除步骤（创作端，工单 #6）：后续步骤序号前移保持连续 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  await deleteCourseStep(
    user.id,
    user.role,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'stepId') ?? '',
  )
  return { ok: true }
})
