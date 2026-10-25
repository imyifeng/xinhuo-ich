import { listAdminUsers } from '../../../utils/services/admin-user.service'

/** 账号列表（管理端，工单 #5）：搜索/角色筛选 + 分页 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminUsers({
    q: typeof query.q === 'string' ? query.q : undefined,
    role: typeof query.role === 'string' ? query.role : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
