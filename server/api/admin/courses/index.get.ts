import { listAdminCourses } from '../../../utils/services/admin-course.service'

/** 课程列表（管理端，工单 #6）：全部状态可见，支持状态筛选与分页 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminCourses({
    status: typeof query.status === 'string' ? query.status : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
