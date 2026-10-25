# 薪火平台数据字典

> 由 `docs/report-assets/database/generate.mjs` 从 `prisma/schema.prisma` 自动生成（重生成：
> `node docs/report-assets/database/generate.mjs`）。对应报告 4.6.1「实体表设计」与 4.6.2「索引设计」素材。
> 术语以根目录 GLOSSARY.md 为准；类型为 Prisma 字段映射到 PostgreSQL 之后的实际类型。

## 4.6.1 实体表

共 13 张实体表。「列名」为数据库实际列名（Prisma @map 映射后的 snake_case）。

### user —— 账号

> 账号 —— 学习者、传承人与管理员的登录主体（自实现认证：argon2 哈希 + Redis 会话）

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | 主键（自增） | 自增主键 |
| `username` | `username` | text | 唯一 | 登录用户名，全局唯一（3~30 字符） |
| `display_name` | `displayName` | text | — | 对外展示的昵称 |
| `password_hash` | `passwordHash` | text | — | argon2 哈希，永不出库（见规格 #1 Implementation Decisions） |
| `role` | `role` | enum Role | 默认 LEARNER | 平台角色：学习者 / 传承人 / 管理员 |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 注册时间 |

**索引与唯一约束**：`唯一 (username)`

### craft_item —— 技艺条目

> 技艺条目 —— 平台内容的基本单元，对应传统技艺类非遗代表性名录中的一项

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键（对外暴露的条目 ID） |
| `name` | `name` | text | 唯一 | 条目名称，全局唯一 |
| `subcategory` | `subcategory` | text | — | 子类别（陶瓷、织绣、漆器、造纸印刷、金属加工、酿造等） |
| `batch` | `batch` | text | — | 列入国家级名录的批次（如“第一批（2006 年）”） |
| `code` | `code` | text | — | 国家级名录编号（如“Ⅷ-1”） |
| `region` | `region` | text | — | 申报地区 |
| `history` | `history` | text | — | 历史渊源 |
| `features` | `features` | text | — | 工艺特色 |
| `images` | `images` | jsonb | 默认 []（空数组） | 图集：{url, credit} 数组，credit 标注图片出处与许可 |
| `video_url` | `videoUrl` | text | 可空 | 视频外链（B 站），可空 |
| `status` | `status` | enum CraftItemStatus | 默认 PUBLISHED | 发布状态：仅 PUBLISHED 对游客可见 |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 创建时间 |
| `updated_at` | `updatedAt` | timestamp(3) | — | 更新时间（@updatedAt 自动维护） |

**索引与唯一约束**：`唯一 (name)`、`status, subcategory`

### inheritor —— 传承人

> 传承人 —— 非遗代表性传承人，作为平台展示的人物实体挂在技艺条目下

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `name` | `name` | text | — | 传承人姓名 |
| `bio` | `bio` | text | — | 人物简介 |
| `level` | `level` | text | — | 代表性传承人级别（国家级/省级等） |
| `craft_item_id` | `craftItemId` | text | 外键 → craft_item.id，ON DELETE CASCADE | 所属技艺条目（外键，级联删除） |

**索引与唯一约束**：`唯一 craft_item_id, name`

### tag —— 标签

> 条目标签 —— 推荐算法的数据源

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `name` | `name` | text | 唯一 | 标签名，全局唯一 |

**索引与唯一约束**：`唯一 (name)`

### craft_item_tag —— 条目标签关联（多对多联结表）

> 技艺条目 ↔ 标签 多对多

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `craft_item_id` | `craftItemId` | text | 联合主键，外键 → craft_item.id，ON DELETE CASCADE | 条目 ID（联合主键之一，外键级联删除） |
| `tag_id` | `tagId` | text | 联合主键，外键 → tag.id，ON DELETE CASCADE | 标签 ID（联合主键之一，外键级联删除） |

### behavior_event —— 学习行为事件

> 学习行为事件 —— 画像的原始数据（仅登录用户），多态目标：targetType + targetId

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `user_id` | `userId` | integer | 外键 → user.id，可空，ON DELETE SET NULL | 触发者；游客不产生事件，理论非空，保留可空以容错脏数据 |
| `type` | `type` | enum BehaviorEventType | — | 事件类型（五类，见枚举 BehaviorEventType） |
| `target_type` | `targetType` | text | — | 目标类型（如 CRAFT_ITEM / COURSE / POST / COMMENT） |
| `target_id` | `targetId` | text | — | 目标 ID（多态，不设数据库外键） |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 发生时间 |

**索引与唯一约束**：`user_id, type`、`type, target_id`

### course —— 课程

> 课程 —— 某个技艺条目下的结构化图文教程，由传承人（或管理员）账号创建并维护（工单 #6）

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `title` | `title` | text | — | 课程标题 |
| `intro` | `intro` | text | — | 课程简介 |
| `craft_item_id` | `craftItemId` | text | 外键 → craft_item.id，ON DELETE CASCADE | 挂载的技艺条目 |
| `author_id` | `authorId` | integer | 外键 → user.id，ON DELETE CASCADE | 作者（传承人账号，管理员代建时为其本人） |
| `status` | `status` | enum CourseStatus | 默认 DRAFT | 发布状态：DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED（工单 #6） |
| `reject_reason` | `rejectReason` | text | 可空 | 驳回理由（管理员驳回时可附，传承人可见；重新提交时清空） |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 创建时间 |
| `updated_at` | `updatedAt` | timestamp(3) | — | 更新时间（@updatedAt 自动维护） |

**索引与唯一约束**：`craft_item_id, status`、`author_id`

### step —— 步骤

> 步骤 —— 课程的最小学习单元，对应一道工序或一个知识点（工单 #6）

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `course_id` | `courseId` | text | 外键 → course.id，ON DELETE CASCADE | 所属课程（外键，级联删除） |
| `order` | `order` | integer | — | 同课程内从 1 递增的排序（唯一约束保证不重不漏） |
| `title` | `title` | text | — | 步骤标题 |
| `content` | `content` | text | — | 图文内容 |
| `image_url` | `imageUrl` | text | 可空 | 可选配图地址 |

**索引与唯一约束**：`唯一 course_id, order`

### learning_record —— 学习进度记录

> 学习进度记录 —— 学习者已完成步骤（工单 #6）。 userId + stepId 联合主键天然幂等：重复标记完成不会产生重复记录； 学习进度 = 某课程下 learning_record 数 / 该课程总步骤数。

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `user_id` | `userId` | integer | 联合主键，外键 → user.id，ON DELETE CASCADE | 学习者（联合主键之一，外键级联删除） |
| `step_id` | `stepId` | text | 联合主键，外键 → step.id，ON DELETE CASCADE | 已完成步骤（联合主键之一，外键级联删除） |
| `completed_at` | `completedAt` | timestamp(3) | 默认 now() | 完成时间 |

**索引与唯一约束**：`step_id`

### post —— 帖子

> 帖子 —— 学习者在交流区发布的主题讨论（术语见 GLOSSARY：帖子）

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `author_id` | `authorId` | integer | 外键 → user.id，ON DELETE CASCADE | 发帖作者（外键，级联删除） |
| `title` | `title` | text | — | 标题（1~80 字符） |
| `content` | `content` | text | — | 正文 |
| `status` | `status` | enum ContentStatus | 默认 VISIBLE | 管理员下架即 HIDDEN，前台与列表一律不可见 |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 发布时间（列表按其倒序） |

**索引与唯一约束**：`status, created_at`

### comment —— 评论

> 评论 —— 对帖子的回复；课程不设评论，课程讨论引流到交流区（术语见 GLOSSARY：评论）

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `post_id` | `postId` | text | 外键 → post.id，ON DELETE CASCADE | 所属帖子（外键，级联删除） |
| `author_id` | `authorId` | integer | 外键 → user.id，ON DELETE CASCADE | 评论作者（外键，级联删除） |
| `content` | `content` | text | — | 正文 |
| `status` | `status` | enum ContentStatus | 默认 VISIBLE | 管理员下架即 HIDDEN，详情页与评论数均不计 |
| `created_at` | `createdAt` | timestamp(3) | 默认 now() | 评论时间 |

**索引与唯一约束**：`post_id, status`、`author_id`

### learner_profile —— 学习者画像

> 学习者画像（工单 #8）—— 离线 K-Means 聚类的结果落库，每位学习者至多一行（userId 即主键，整批重建）。 术语见 GLOSSARY：学习者画像；命名规则：簇内子类别浏览占比最高者 → "XX爱好者型"，无法命名退"综合浏览型"。

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `user_id` | `userId` | integer | 主键，外键 → user.id，ON DELETE CASCADE | 学习者（主键，外键级联删除；一人至多一份画像） |
| `cluster_label` | `clusterLabel` | text | — | 可读画像标签（如"陶瓷爱好者型"） |
| `cluster_index` | `clusterIndex` | integer | — | 簇编号（K-Means 输出）：标签可能同名（两簇同以陶瓷为主），簇编号必不同，管理端按它统计分布 |
| `feature_vector` | `featureVector` | jsonb | — | 自描述特征向量 JSON：{ dimensions: string[], values: number[] }， |
| `updated_at` | `updatedAt` | timestamp(3) | — | 重建时间（@updatedAt 自动维护） |

**索引与唯一约束**：`cluster_index`

### recommendation —— 个性化推荐

> 个性化推荐（工单 #8）—— 离线管道写给每位学习者的推荐结果（先清后写，整批重建）。 术语见 GLOSSARY：个性化推荐；条目与课程各占一行，二选一（另一列为空）。

| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | text | 主键，默认 cuid() | cuid 字符串主键 |
| `user_id` | `userId` | integer | 外键 → user.id，ON DELETE CASCADE | 推荐归属的学习者（外键，级联删除） |
| `craft_item_id` | `craftItemId` | text | 可空 | 推荐的技艺条目 ID（多态不设外键，与 behavior_event 同法；读取时联表过滤已下架条目） |
| `course_id` | `courseId` | text | 可空 | 推荐的课程 ID（与 craftItemId 二选一） |
| `score` | `score` | double precision | — | 推荐分（0~1）：簇内热度为簇内归一化浏览/学习次数，相似度为标签 TF-IDF 余弦相似度 |
| `reason` | `reason` | text | — | 汉字短理由（如"同好都在学"/"内容与你看过《X》相似"/"全站热门"），前台直接展示 |
| `generated_at` | `generatedAt` | timestamp(3) | — | 管道生成时间 |

**索引与唯一约束**：`user_id, score`

## 枚举类型

### Role —— 平台角色：学习者 / 传承人 / 管理员（传承人由管理员线下核实后标记，无线上自助认证）

- `LEARNER`
- `INHERITOR`
- `ADMIN`

### CraftItemStatus —— 技艺条目发布状态：仅 PUBLISHED 对游客可见

- `DRAFT`
- `PUBLISHED`

### ContentStatus —— 交流区内容状态（帖子/评论共用）：管理员下架即 HIDDEN，恢复回 VISIBLE

- `VISIBLE`
- `HIDDEN`

### BehaviorEventType —— 学习行为事件类型（规格 #1 用户故事 27 的五类，仅登录用户记录）

- `VIEW_ITEM`：浏览技艺条目详情
- `START_COURSE`：开始课程
- `COMPLETE_STEP`：完成步骤
- `CREATE_POST`：发帖
- `CREATE_COMMENT`：评论

### CourseStatus —— 课程发布状态：草稿 → 提交审核 → 管理员发布或驳回（工单 #6）

- `DRAFT`
- `PENDING_REVIEW`
- `PUBLISHED`
- `REJECTED`

## 4.6.2 索引设计汇总

| 表 | 索引 | 设计意图 |
| --- | --- | --- |
| craft_item | `status, subcategory` | 列表页默认「已发布」过滤 + 子类别筛选的组合条件，覆盖首页/列表高频查询 |
| behavior_event | `user_id, type` | 画像管道按用户聚合五类事件（工单 #8） |
| behavior_event | `type, target_id` | 簇内热度统计按「事件类型 + 目标」聚合浏览/学习次数 |
| course | `craft_item_id, status` | 条目页「相关课程」按条目取已发布课程 |
| course | `author_id` | 传承人 /studio 课程列表按作者查询 |
| learning_record | `step_id` | 按步骤统计完成人数；联合主键 (user_id, step_id) 已覆盖按用户查进度 |
| post | `status, created_at` | 交流区列表按「可见 + 时间倒序」查询 |
| comment | `post_id, status` | 帖子详情按帖子取可见评论 |
| comment | `author_id` | 按作者查评论 |
| learner_profile | `cluster_index` | 管理端画像统计按簇分组计数 |
| recommendation | `user_id, score` | 推荐流按用户取分值倒序前列 |

> 唯一约束补充：user.username、craft_item.name、tag.name（单列唯一）；
> inheritor(craft_item_id, name)、step(course_id, order)（复合唯一）；
> craft_item_tag(craft_item_id, tag_id)、learning_record(user_id, step_id)、learner_profile(user_id)（复合主键兼唯一）。
