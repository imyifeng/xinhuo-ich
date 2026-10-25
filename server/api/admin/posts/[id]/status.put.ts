import { setPostStatus } from '../../../../utils/services/admin-post.service'

/** 下架/恢复帖子（管理端，工单 #7 / 用户故事 24）：body { status: 'VISIBLE' | 'HIDDEN' } */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') ?? ''
  return setPostStatus(id, await readBody(event))
})
