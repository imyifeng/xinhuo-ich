import { listAdminPosts } from '../../../utils/services/admin-post.service'

/** 帖子列表（管理端，工单 #7）：含已下架，?status=&page=&pageSize= */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminPosts({
    status: typeof query.status === 'string' ? query.status : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
