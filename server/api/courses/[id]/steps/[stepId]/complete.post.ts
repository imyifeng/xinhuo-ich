import { completeStep } from '../../../../../utils/services/learning.service'
/** 标记步骤完成（学习者端，工单 #6）：learning_record 幂等落库 + 首次完成记 COMPLETE_STEP 事件，返回最新进度 */
export default defineCourseHandler(async (event) => {
  const user = await requireSessionUser(event)
  return completeStep(
    user.id,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'stepId') ?? '',
  )
})
