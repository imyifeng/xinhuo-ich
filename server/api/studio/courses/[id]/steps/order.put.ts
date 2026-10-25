import { reorderCourseSteps } from '../../../../../utils/services/course.service'

/** 步骤重排（创作端，工单 #6）：全量语义，stepIds 为目标顺序的全部步骤 ID */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return reorderCourseSteps(user.id, user.role, getRouterParam(event, 'id') ?? '', await readBody(event))
})
