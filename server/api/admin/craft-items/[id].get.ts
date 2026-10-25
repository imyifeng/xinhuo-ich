import { getAdminCraftItem } from '../../../utils/services/admin-craft-item.service'

/** 技艺条目详情（管理端，编辑表单回显用）：含 tagIds，不存在 404 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return getAdminCraftItem(getRouterParam(event, 'id') ?? '')
})
