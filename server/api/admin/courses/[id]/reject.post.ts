import { rejectAdminCourse } from '../../../../utils/services/admin-course.service'

/** 驳回课程（管理端，工单 #6）：仅待审核课程可驳回（PENDING_REVIEW → REJECTED），理由可选 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return rejectAdminCourse(getRouterParam(event, 'id') ?? '', await readBody(event))
})
