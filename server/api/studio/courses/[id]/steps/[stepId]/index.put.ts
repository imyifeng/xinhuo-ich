import { updateCourseStep } from '../../../../../../utils/services/course.service'

/** 更新步骤（创作端，工单 #6）：部分更新语义 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return updateCourseStep(
    user.id,
    user.role,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'stepId') ?? '',
    await readBody(event),
  )
})
