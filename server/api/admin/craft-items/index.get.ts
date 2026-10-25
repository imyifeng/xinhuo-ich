import { listAdminCraftItems } from '../../../utils/services/admin-craft-item.service'

/** 技艺条目列表（管理端，工单 #5）：含未发布，支持状态/子类别筛选与名称搜索 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminCraftItems({
    status: typeof query.status === 'string' ? query.status : undefined,
    subcategory: typeof query.subcategory === 'string' ? query.subcategory : undefined,
    q: typeof query.q === 'string' ? query.q : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
