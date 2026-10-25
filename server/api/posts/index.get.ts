import { listPosts } from '../../utils/services/post.service'

/** 交流区帖子列表（公开，工单 #7）：仅可见帖，?page=&pageSize= */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  return listPosts({
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
