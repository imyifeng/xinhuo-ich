# 测试用例及结果汇总（报告第 6 章素材）

> 由 `pnpm test`（vitest run）于 2026-10-25 在本 worktree 真实运行生成（运行方式与归档说明见本目录 README.md）。
> 当次运行：**27 个测试文件 / 172 条测试用例，全部通过（0 失败）**，总时长约 228 s。
> 测试形态：HTTP API 集成测试（@nuxt/test-utils 起真实 Nitro 服务，接缝 1）+ 推荐算法单元测试；
> 每次运行前 global-setup 强制重置测试专用数据库（xinhuo_test_t10）。

## 用例明细

### HTTP API · 基础接口

#### `tests/api/health.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/health · 返回 ok 状态并报告数据库与 Redis 均可用 | ✅ 通过 | 13 ms |
| GET /api/health · 报告进程运行时长与响应时间戳 | ✅ 通过 | 4 ms |

#### `tests/api/stats.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/stats · 空库时各计数为零 | ✅ 通过 | 63 ms |
| GET /api/stats · 返回技艺条目总数与去重后的子类别数 | ✅ 通过 | 17 ms |

### HTTP API · 认证（工单 #2）

#### `tests/api/auth.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 认证竖切 /api/auth › POST /api/auth/register · 合法用户名与密码注册成功，返回 201 与用户信息（不含密码哈希） | ✅ 通过 | 21 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 密码以 argon2 哈希落库（数据库状态断言） | ✅ 通过 | 7 ms |
| 认证竖切 /api/auth › POST /api/auth/register · displayName 缺省时回退为用户名 | ✅ 通过 | 12 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 重复用户名返回 409 | ✅ 通过 | 13 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 非法用户名（过短（2 字符））返回 400 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 非法用户名（过长（31 字符））返回 400 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 非法用户名（含非法字符）返回 400 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 非法用户名（含空格）返回 400 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 非法用户名（空字符串）返回 400 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 密码不足 8 位返回 400 | ✅ 通过 | 2 ms |
| 认证竖切 /api/auth › POST /api/auth/register · 缺少字段返回 400 | ✅ 通过 | 2 ms |
| 认证竖切 /api/auth › POST /api/auth/login · 正确密码登录成功，签发 httpOnly 会话 Cookie 并返回用户信息 | ✅ 通过 | 17 ms |
| 认证竖切 /api/auth › POST /api/auth/login · 会话写入 Redis（共享契约：session:<token>，TTL 7 天） | ✅ 通过 | 16 ms |
| 认证竖切 /api/auth › POST /api/auth/login · 密码错误返回 401 | ✅ 通过 | 10 ms |
| 认证竖切 /api/auth › POST /api/auth/login · 用户名不存在返回 401（与密码错误同语意，不泄漏账号存在性） | ✅ 通过 | 16 ms |
| 认证竖切 /api/auth › POST /api/auth/login · 缺少字段返回 401 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › GET /api/auth/me 与 POST /api/auth/logout（全流程） · 未登录访问 me 返回 401 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › GET /api/auth/me 与 POST /api/auth/logout（全流程） · 携带伪造/未知 token 的 Cookie 访问 me 返回 401 | ✅ 通过 | 1 ms |
| 认证竖切 /api/auth › GET /api/auth/me 与 POST /api/auth/logout（全流程） · 注册 → 登录 → 我的信息 → 登出 → 原 Cookie 再访 me 401（验收主链路） | ✅ 通过 | 28 ms |
| 认证竖切 /api/auth › GET /api/auth/me 与 POST /api/auth/logout（全流程） · 登出即销毁 Redis 会话键（契约：session:<token> 立即删除） | ✅ 通过 | 21 ms |
| 认证竖切 /api/auth › GET /api/auth/me 与 POST /api/auth/logout（全流程） · 未登录登出幂等返回 200 | ✅ 通过 | 1 ms |

### HTTP API · 技艺条目（工单 #3）

#### `tests/api/craft-items.detail.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/craft-items/:id · 返回详情：展示字段、传承人与标签齐全 | ✅ 通过 | 107 ms |
| GET /api/craft-items/:id · 不存在的 ID 返回 404 | ✅ 通过 | 4 ms |
| GET /api/craft-items/:id · 未发布（草稿）条目对游客返回 404 | ✅ 通过 | 14 ms |

#### `tests/api/craft-items.events.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 技艺条目详情的 VIEW_ITEM 事件 · 登录用户浏览详情：写入 VIEW_ITEM 事件（用户/类型/目标齐全） | ✅ 通过 | 121 ms |
| 技艺条目详情的 VIEW_ITEM 事件 · 游客浏览详情：不产生事件，详情仍正常返回 | ✅ 通过 | 21 ms |
| 技艺条目详情的 VIEW_ITEM 事件 · 无效会话（Redis 无此 token）：不产生事件，详情仍 200 | ✅ 通过 | 12 ms |
| 技艺条目详情的 VIEW_ITEM 事件 · 404 的条目即使携带会话也不产生事件 | ✅ 通过 | 11 ms |

#### `tests/api/craft-items.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/craft-items · 空库时返回空列表与零总数 | ✅ 通过 | 72 ms |
| GET /api/craft-items · 仅返回已发布条目并附带子类别清单 | ✅ 通过 | 25 ms |
| GET /api/craft-items · 按子类别筛选：仅返回该子类别的已发布条目 | ✅ 通过 | 16 ms |
| GET /api/craft-items · 筛选无匹配子类别时返回空列表 | ✅ 通过 | 9 ms |
| GET /api/craft-items · 分页：pageSize 与 page 生效，总数不随分页变化 | ✅ 通过 | 19 ms |
| GET /api/craft-items · 非法分页参数回退到安全范围（page 从 1 起，pageSize 上限 50） | ✅ 通过 | 17 ms |

### HTTP API · 条目与缓存（工单 #3/#9）

#### `tests/api/craft-items.cache-bypass.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/craft-items/:id 缓存关闭（CACHE_ENABLED=false） · 所有请求返回 BYPASS 且内容正确，缓存计数不增长 | ✅ 通过 | 101 ms |
| GET /api/craft-items/:id 缓存关闭（CACHE_ENABLED=false） · 缓存关闭下数据更新立即可见（无陈旧窗口） | ✅ 通过 | 22 ms |

#### `tests/api/craft-items.cache.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| GET /api/craft-items/:id 缓存（cache-aside） · 首次请求 MISS 回源，二次请求 HIT 且内容一致 | ✅ 通过 | 113 ms |
| GET /api/craft-items/:id 缓存（cache-aside） · 数据更新后缓存仍返回旧值，经失效路径取到新值（MISS 重建后 HIT） | ✅ 通过 | 27 ms |
| GET /api/craft-items/:id 缓存（cache-aside） · 不存在的 ID：404 首次 MISS，空值缓存期内重复请求为 HIT 且不再产生 MISS 计数 | ✅ 通过 | 10 ms |
| GET /api/craft-items/:id 缓存（cache-aside） · 并发请求同一未缓存条目：只回源一次（MISS 计数 +1），响应均为 200 且内容一致 | ✅ 通过 | 18 ms |
| GET /api/craft-items/:id 缓存（cache-aside） · 管理端更新/删除后详情缓存自动失效：更新即 MISS 取新值，删除即 404（T4 写路径接线） | ✅ 通过 | 43 ms |

### HTTP API · 管理端（工单 #4/#5）

#### `tests/api/admin/access.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端访问控制 · 未登录访问管理接口返回 403（未登录也是 403，非 401） | ✅ 通过 | 4 ms |
| 管理端访问控制 · 学习者会话访问管理接口返回 403 | ✅ 通过 | 10 ms |
| 管理端访问控制 · 未登录访问 /admin 页面被服务端中间件重定向到 /login | ✅ 通过 | 1 ms |
| 管理端访问控制 · 学习者会话访问 /admin 页面被重定向到 /login | ✅ 通过 | 2 ms |
| 管理端访问控制 · 伪造无效会话访问管理接口同样 403 | ✅ 通过 | 1 ms |
| 管理端访问控制 · 管理员打开 /admin 跳到技艺条目页，且管理页面真实渲染（不再被弹回 /login） | ✅ 通过 | 62 ms |

#### `tests/api/admin/craft-items.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端技艺条目 CRUD /api/admin/craft-items · 未登录与学习者创建条目均 403 | ✅ 通过 | 15 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 管理员创建条目（含标签关联与图集）返回 201 与完整字段，标签关联落库 | ✅ 通过 | 35 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 创建时名称与既有条目重复返回 409 | ✅ 通过 | 12 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 创建时包含不存在的标签 ID 返回 400 | ✅ 通过 | 3 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 创建时缺少必填字段返回 400 | ✅ 通过 | 6 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 管理列表含未发布条目，支持状态/子类别筛选与名称搜索 | ✅ 通过 | 36 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 条目详情（编辑用）返回 tagIds；不存在的 ID 返回 404 | ✅ 通过 | 17 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 更新条目：字段生效且标签关联整体替换；不存在返回 404，名称冲突返回 409 | ✅ 通过 | 42 ms |
| 管理端技艺条目 CRUD /api/admin/craft-items · 删除条目后列表与详情均不可见，级联解除标签关联；不存在返回 404 | ✅ 通过 | 22 ms |

#### `tests/api/admin/inheritors.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端传承人 CRUD /api/admin/inheritors · 未登录与学习者创建传承人均 403 | ✅ 通过 | 19 ms |
| 管理端传承人 CRUD /api/admin/inheritors · 管理员创建传承人（挂条目）返回 201；所属条目不存在返回 400 | ✅ 通过 | 26 ms |
| 管理端传承人 CRUD /api/admin/inheritors · 同一条目下传承人重名返回 409；不同条目允许同名 | ✅ 通过 | 21 ms |
| 管理端传承人 CRUD /api/admin/inheritors · 列表支持按条目筛选并附带条目名称 | ✅ 通过 | 23 ms |
| 管理端传承人 CRUD /api/admin/inheritors · 更新传承人：字段生效且可改挂条目；不存在 404 | ✅ 通过 | 22 ms |
| 管理端传承人 CRUD /api/admin/inheritors · 删除传承人；不存在 404 | ✅ 通过 | 17 ms |

#### `tests/api/admin/posts.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端内容审核 · 非管理员（未登录/学习者）访问管理帖子接口一律 403 | ✅ 通过 | 18 ms |
| 管理端内容审核 · 管理员帖子列表含已下架帖子，且可按状态筛选 | ✅ 通过 | 36 ms |
| 管理端内容审核 · 下架帖子后公开列表/详情不可见，恢复后可见 | ✅ 通过 | 45 ms |
| 管理端内容审核 · 下架不存在的帖子返回 404 | ✅ 通过 | 7 ms |
| 管理端内容审核 · 管理员评论列表含状态与所属帖子，可按状态筛选 | ✅ 通过 | 23 ms |
| 管理端内容审核 · 下架评论后详情与评论数不含它，恢复后回来 | ✅ 通过 | 33 ms |
| 管理端内容审核 · 下架不存在的评论返回 404 | ✅ 通过 | 7 ms |

#### `tests/api/admin/tags.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端标签 CRUD /api/admin/tags · 未登录与学习者创建标签均 403 | ✅ 通过 | 15 ms |
| 管理端标签 CRUD /api/admin/tags · 管理员创建标签返回 201；重名 409；空名 400 | ✅ 通过 | 25 ms |
| 管理端标签 CRUD /api/admin/tags · 列表返回各标签的关联条目数并支持名称搜索 | ✅ 通过 | 22 ms |
| 管理端标签 CRUD /api/admin/tags · 重命名标签：生效且不影响关联；不存在 404；重名 409 | ✅ 通过 | 23 ms |
| 管理端标签 CRUD /api/admin/tags · 删除标签时解除与条目的关联（条目仍在，公开标签列表不再含该标签） | ✅ 通过 | 19 ms |

#### `tests/api/admin/users.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 管理端账号管理 /api/admin/users · 未登录修改角色 403；学习者访问账号列表 403 | ✅ 通过 | 20 ms |
| 管理端账号管理 /api/admin/users · 账号列表：分页、名称/用户名搜索与角色筛选 | ✅ 通过 | 30 ms |
| 管理端账号管理 /api/admin/users · 角色标记：学习者 → 传承人落库并返回公开用户信息 | ✅ 通过 | 17 ms |
| 管理端账号管理 /api/admin/users · 角色不合法返回 400；用户不存在返回 404 | ✅ 通过 | 11 ms |
| 管理端账号管理 /api/admin/users · 角色标记即时生效：学习者被标记为管理员后，既有会话即可访问管理端（角色查库） | ✅ 通过 | 12 ms |

### HTTP API · 课程与学习进度（工单 #6）

#### `tests/api/courses.learning.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 学习进度与行为事件 /api/courses + /api/me/courses · 开始课程：写入 START_COURSE 事件（目标 COURSE） | ✅ 通过 | 29 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 重复开始与第二次请求：每课程每用户仅一条 START_COURSE 事件 | ✅ 通过 | 9 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 未登录开始课程 401；未发布课程 404 | ✅ 通过 | 7 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 标记步骤完成：learning_record 落库 + COMPLETE_STEP 事件，返回进度 | ✅ 通过 | 19 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 重复完成幂等：记录与 COMPLETE_STEP 事件均不重复 | ✅ 通过 | 7 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 不同用户、不同步骤互不干扰：进度各自累计 | ✅ 通过 | 22 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 未登录标记完成 401；未发布课程的步骤 404 | ✅ 通过 | 9 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 我的课程进度：每门课已完成/总步骤，按最近完成时间排序 | ✅ 通过 | 21 ms |
| 学习进度与行为事件 /api/courses + /api/me/courses · 未登录访问我的课程进度 401 | ✅ 通过 | 1 ms |

#### `tests/api/courses.manage.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 传承人端课程管理 /api/studio/courses · 传承人创建课程：201，默认草稿状态，挂在指定条目下 | ✅ 通过 | 37 ms |
| 传承人端课程管理 /api/studio/courses · 未登录创建课程 401，学习者 403 | ✅ 通过 | 5 ms |
| 传承人端课程管理 /api/studio/courses · 缺字段或条目不存在：400 | ✅ 通过 | 6 ms |
| 传承人端课程管理 /api/studio/courses · 传承人课程列表：只包含自己的课程 | ✅ 通过 | 13 ms |
| 传承人端课程管理 /api/studio/courses · 更新课程信息：标题/简介/挂载条目均可改 | ✅ 通过 | 25 ms |
| 传承人端课程管理 /api/studio/courses · 添加步骤：order 自动递增；更新与删除后序号保持连续 | ✅ 通过 | 54 ms |
| 传承人端课程管理 /api/studio/courses · 重排步骤：按传入的 stepIds 顺序重排，非法入参 400 | ✅ 通过 | 20 ms |
| 传承人端课程管理 /api/studio/courses · 他人（传承人 B）读写删 A 的课程一律 404；管理员可读写 | ✅ 通过 | 19 ms |
| 传承人端课程管理 /api/studio/courses · 待审核/已发布/已驳回的既有课程：非草稿不可编辑步骤与信息（已驳回可改） | ✅ 通过 | 17 ms |
| 传承人端课程管理 /api/studio/courses · 删除课程：作者可删除自己的草稿 | ✅ 通过 | 13 ms |

#### `tests/api/courses.public.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 课程公开浏览 /api/courses · 课程列表仅含已发布课程，支持按条目筛选 | ✅ 通过 | 18 ms |
| 课程公开浏览 /api/courses · 已发布课程详情：步骤按序返回 | ✅ 通过 | 13 ms |
| 课程公开浏览 /api/courses · 游客详情仅见大纲：步骤 content 为 null，progress 为 null | ✅ 通过 | 5 ms |
| 课程公开浏览 /api/courses · 登录用户详情：步骤内容可见，progress 返回已完成/总步骤 | ✅ 通过 | 15 ms |
| 课程公开浏览 /api/courses · 未发布课程详情 404（草稿/待审核/已驳回一律不可见） | ✅ 通过 | 10 ms |

#### `tests/api/courses.review.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 课程提交与审核 /api/studio + /api/admin/courses · 提交审核：草稿 → 待审核 | ✅ 通过 | 48 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 无步骤的草稿不能提交：400 | ✅ 通过 | 9 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 重复提交（已是待审核）409 | ✅ 通过 | 26 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 管理员待审列表：默认返回待审核，含作者与条目信息 | ✅ 通过 | 9 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 非管理员访问审核接口 403（未登录同样 403，沿用管理端契约） | ✅ 通过 | 6 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 管理员发布：待审核 → 已发布 | ✅ 通过 | 29 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 管理员驳回：待审核 → 已驳回，理由落库且传承人可见 | ✅ 通过 | 33 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 驳回可不带理由；非法状态直接发布/驳回 409 | ✅ 通过 | 22 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 已驳回课程修改后可重新提交，旧理由被清空 | ✅ 通过 | 34 ms |
| 课程提交与审核 /api/studio + /api/admin/courses · 作者（传承人）提交他人课程 404 | ✅ 通过 | 9 ms |

### HTTP API · 交流区（工单 #7）

#### `tests/api/posts.comments.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 评论帖子 POST /api/posts/:id/comments · 未登录评论返回 401，不落库不落事件 | ✅ 通过 | 77 ms |
| 评论帖子 POST /api/posts/:id/comments · 登录学习者评论成功：201 落库并写 CREATE_COMMENT 事件 | ✅ 通过 | 45 ms |
| 评论帖子 POST /api/posts/:id/comments · 对不存在或已下架的帖子评论返回 404，不落库 | ✅ 通过 | 17 ms |
| 评论帖子 POST /api/posts/:id/comments · 评论内容缺失返回 400 | ✅ 通过 | 10 ms |

#### `tests/api/posts.create.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 发帖 POST /api/posts · 未登录发帖返回 401，不落库不落事件 | ✅ 通过 | 60 ms |
| 发帖 POST /api/posts · 无效会话（Redis 无此 token）返回 401 | ✅ 通过 | 8 ms |
| 发帖 POST /api/posts · 登录学习者发帖成功：201 落库（默认可见），并写 CREATE_POST 事件 | ✅ 通过 | 41 ms |
| 发帖 POST /api/posts · 传承人与管理员也可发帖（仅登录即可） | ✅ 通过 | 25 ms |
| 发帖 POST /api/posts · 标题或正文缺失返回 400，不落库不落事件 | ✅ 通过 | 11 ms |

#### `tests/api/posts.detail.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 帖子详情 GET /api/posts/:id · 游客可看详情：正文、作者昵称与可见评论列表（按时间正序），下架评论不计 | ✅ 通过 | 89 ms |
| 帖子详情 GET /api/posts/:id · 已下架帖子返回 404 | ✅ 通过 | 14 ms |
| 帖子详情 GET /api/posts/:id · 不存在的帖子 ID 返回 404 | ✅ 通过 | 5 ms |

#### `tests/api/posts.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 交流区帖子列表 GET /api/posts · 仅返回 VISIBLE 帖子，按创建时间倒序，含作者昵称与可见评论数 | ✅ 通过 | 92 ms |
| 交流区帖子列表 GET /api/posts · 分页：page/pageSize 切片并回传总数与页码 | ✅ 通过 | 23 ms |

### HTTP API · 画像与推荐（工单 #8）

#### `tests/api/recommendations.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| 画像与推荐竖切 · 非管理员触发重建返回 403，未登录也 403 | ✅ 通过 | 13 ms |
| 画像与推荐竖切 · 管理员触发重建：返回各簇人数、k 与计数，learner_profile 落库且簇分布合计=画像数 | ✅ 通过 | 32 ms |
| 画像与推荐竖切 · 画像统计：管理员可读各簇人数分布，特征均值逐维可解释 | ✅ 通过 | 5 ms |
| 画像与推荐竖切 · 有画像学习者：推荐非空、不含本人已浏览条目、reason 为非空汉字 | ✅ 通过 | 17 ms |
| 画像与推荐竖切 · 冷启动学习者（无行为事件）：画像为空但推荐兜底非空 | ✅ 通过 | 8 ms |
| 画像与推荐竖切 · 游客取推荐返回 401 | ✅ 通过 | 1 ms |

### 单元测试 · 推荐算法（工单 #8）

#### `tests/unit/recommendation/feature-vector.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| buildFeatureVector · 维度顺序为 子类别浏览占比 → 课程完成度 → 发帖/评论活跃度，子类别按名称排序 | ✅ 通过 | 1 ms |
| buildFeatureVector · 浏览占比 = 子类别浏览次数 / 总浏览次数（手算：3+1 次中陶瓷占 3/4） | ✅ 通过 | 0 ms |
| buildFeatureVector · 无条目浏览时各占比为 0 而非 NaN | ✅ 通过 | 0 ms |
| buildFeatureVector · 指向不存在条目的浏览事件不计入分子也不计入分母（悬空目标容错） | ✅ 通过 | 0 ms |
| buildFeatureVector · 课程完成度 = 已完成步骤数 / 总步骤数；总步骤数为 0 的课程占维但恒为 0（防除零） | ✅ 通过 | 0 ms |
| buildFeatureVector · 发帖/评论活跃度 = n/(n+5) 饱和归一化（手算：5 帖 → 0.5，15 评论 → 0.75） | ✅ 通过 | 0 ms |
| buildFeatureVector · 维度清单为空（无子类别无课程）时仅剩两个活跃度维度 | ✅ 通过 | 0 ms |
| buildFeatureVector · 全体学习者共享同一维度清单：无行为学习者得到同长全零向量（K-Means 不产生 NaN） | ✅ 通过 | 0 ms |

#### `tests/unit/recommendation/kmeans.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| kMeans · 六个二维点分两簇：划分与手算一致，总 SSE = 8/3 | ✅ 通过 | 2 ms |
| kMeans · 同 seed 同结果：质心与划分逐元素相等（可复现性） | ✅ 通过 | 0 ms |
| kMeans · 空数据返回空结果（assignments/centroids 为空、sse = 0），不抛错 | ✅ 通过 | 0 ms |
| kMeans · 单样本：k 夹到 1，样本自成一簇且 sse = 0 | ✅ 通过 | 0 ms |
| kMeans · k 大于样本数时夹到样本数：每点一簇、sse = 0（不抛错不产生空簇） | ✅ 通过 | 0 ms |
| kMeans · 不变量：每个样本都被分到距其最近的质心（欧氏距离，含 maxIterations 提前截断的情况） | ✅ 通过 | 0 ms |
| kMeans · 不变量：k ≤ 样本数时任何 seed 下都不产生空簇 | ✅ 通过 | 0 ms |
| kMeans · 全零向量（无行为学习者）可与正常向量同聚类，不产生 NaN | ✅ 通过 | 0 ms |
| chooseKByElbow（手肘法） · 九个点三个分离紧致簇（手算各簇内 SSE = 2/3）：选出 k = 3 | ✅ 通过 | 0 ms |
| chooseKByElbow（手肘法） · n = 2 时无法取 k ≥ 2：退 k = 1 | ✅ 通过 | 0 ms |
| chooseKByElbow（手肘法） · n = 3 时候选仅 k = 2：直接取 2 | ✅ 通过 | 0 ms |
| chooseKByElbow（手肘法） · 空数据退 k = 0 且曲线为空 | ✅ 通过 | 0 ms |

#### `tests/unit/recommendation/tfidf.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| buildTfidfModel + vectorize · 词表按码元排序，idf = ln(N/df)（手算：ln(3/2) 与 ln(3)） | ✅ 通过 | 1 ms |
| buildTfidfModel + vectorize · 向量 = tf·idf（手算：doc0 权重 [ln(3/2), ln(3/2), 0, 0]） | ✅ 通过 | 0 ms |
| buildTfidfModel + vectorize · 词频计入重复标签（tf = 2） | ✅ 通过 | 0 ms |
| buildTfidfModel + vectorize · 语料外词汇不进向量（维度对齐词表，不越界） | ✅ 通过 | 0 ms |
| buildTfidfModel + vectorize · 空语料：空模型与零向量，不抛错 | ✅ 通过 | 0 ms |
| buildTfidfModel + vectorize · 出现在全部文档的词 idf = 0（无区分度，自动失效） | ✅ 通过 | 0 ms |
| cosineSimilarity · 手算：cos([1,0],[1,1]) = 1/√2 | ✅ 通过 | 0 ms |
| cosineSimilarity · 同向向量相似度为 1，正交为 0 | ✅ 通过 | 0 ms |
| cosineSimilarity · 零向量（无标签条目）相似度定义为 0 而非 NaN | ✅ 通过 | 0 ms |
| cosineSimilarity · 空向量相似度为 0 | ✅ 通过 | 0 ms |
| rankBySimilarity · 按与种子向量的余弦相似度降序排列 | ✅ 通过 | 0 ms |
| rankBySimilarity · 相似度并列时按 id 升序（确定性） | ✅ 通过 | 0 ms |
| rankBySimilarity · 空候选池返回空列表 | ✅ 通过 | 0 ms |

### 演示数据管道

#### `tests/demo-seed.test.ts`

| 用例 | 结果 | 耗时 |
| --- | --- | ---: |
| demo:seed 演示数据管道 · 首跑：内容种子、演示账号、行为事件、画像与推荐全部就位 | ✅ 通过 | 1443 ms |
| demo:seed 演示数据管道 · 重跑幂等：行为事件与学习记录不翻倍，画像推荐依旧非空 | ✅ 通过 | 971 ms |

---

共 172 条用例，与运行汇总一致。