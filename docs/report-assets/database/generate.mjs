#!/usr/bin/env node
/**
 * 报告素材生成器（工单 #11）—— 从 prisma/schema.prisma 生成：
 *   1. erd.mmd            —— Mermaid erDiagram 源码（渲染：见 README.md）
 *   2. data-dictionary.md —— 数据字典（报告 4.6.1 实体表设计 / 4.6.2 索引设计素材）
 *
 * 设计约定：
 * - 只依赖 Node 标准库，零第三方包；解析器按本项目 schema 的书写约定实现
 *   （/// 文档注释、@map/@@map、@id/@@id、@unique/@@unique、@@index、@relation）。
 * - 中文表名与字段补充说明写在下方 CHINESE / FIELD_NOTES 映射中，schema 的 /// 注释优先。
 * - 重新生成：node docs/report-assets/database/generate.mjs（在仓库根目录执行）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..', '..')
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma')

// ---------- 中文命名（表名（中文名）；补充字段说明） ----------
const CHINESE = {
  User: '账号',
  CraftItem: '技艺条目',
  Inheritor: '传承人',
  Tag: '标签',
  CraftItemTag: '条目标签关联（多对多联结表）',
  BehaviorEvent: '学习行为事件',
  Course: '课程',
  Step: '步骤',
  LearningRecord: '学习进度记录',
  Post: '帖子',
  Comment: '评论',
  LearnerProfile: '学习者画像',
  Recommendation: '个性化推荐',
}

const FIELD_NOTES = {
  'User.id': '自增主键',
  'User.role': '平台角色：学习者 / 传承人 / 管理员',
  'User.createdAt': '注册时间',
  'CraftItem.id': 'cuid 字符串主键（对外暴露的条目 ID）',
  'CraftItem.name': '条目名称，全局唯一',
  'CraftItem.status': '发布状态：仅 PUBLISHED 对游客可见',
  'CraftItem.createdAt': '创建时间',
  'CraftItem.updatedAt': '更新时间（@updatedAt 自动维护）',
  'Inheritor.id': 'cuid 字符串主键',
  'Inheritor.name': '传承人姓名',
  'Inheritor.craftItemId': '所属技艺条目（外键，级联删除）',
  'Tag.id': 'cuid 字符串主键',
  'Tag.name': '标签名，全局唯一',
  'CraftItemTag.craftItemId': '条目 ID（联合主键之一，外键级联删除）',
  'CraftItemTag.tagId': '标签 ID（联合主键之一，外键级联删除）',
  'BehaviorEvent.id': 'cuid 字符串主键',
  'BehaviorEvent.type': '事件类型（五类，见枚举 BehaviorEventType）',
  'BehaviorEvent.createdAt': '发生时间',
  'Course.id': 'cuid 字符串主键',
  'Course.status': '发布状态：DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED（工单 #6）',
  'Course.createdAt': '创建时间',
  'Course.updatedAt': '更新时间（@updatedAt 自动维护）',
  'Step.id': 'cuid 字符串主键',
  'Step.courseId': '所属课程（外键，级联删除）',
  'LearningRecord.userId': '学习者（联合主键之一，外键级联删除）',
  'LearningRecord.stepId': '已完成步骤（联合主键之一，外键级联删除）',
  'LearningRecord.completedAt': '完成时间',
  'Post.id': 'cuid 字符串主键',
  'Post.authorId': '发帖作者（外键，级联删除）',
  'Post.createdAt': '发布时间（列表按其倒序）',
  'Comment.id': 'cuid 字符串主键',
  'Comment.postId': '所属帖子（外键，级联删除）',
  'Comment.authorId': '评论作者（外键，级联删除）',
  'Comment.createdAt': '评论时间',
  'LearnerProfile.userId': '学习者（主键，外键级联删除；一人至多一份画像）',
  'LearnerProfile.updatedAt': '重建时间（@updatedAt 自动维护）',
  'Recommendation.id': 'cuid 字符串主键',
  'Recommendation.userId': '推荐归属的学习者（外键，级联删除）',
  'Recommendation.generatedAt': '管道生成时间',
}

// ---------- Prisma → PostgreSQL 类型映射 ----------
const PG_TYPES = {
  String: 'text',
  Int: 'integer',
  Float: 'double precision',
  DateTime: 'timestamp(3)',
  Json: 'jsonb',
  Boolean: 'boolean',
}

// Mermaid 实体框内的类型名（只允许字母数字下划线，取简化名；精确 PG 类型见数据字典）
const MERMAID_TYPES = {
  String: 'text',
  Int: 'integer',
  Float: 'float',
  DateTime: 'datetime',
  Json: 'jsonb',
  Boolean: 'boolean',
}

// ---------- 解析 schema.prisma ----------
function parseSchema(source) {
  const lines = source.split('\n')
  const enums = []
  const models = []
  let doc = [] // 挂在下一个声明上的 /// 注释
  let current = null

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('///')) {
      doc.push(line.replace(/^\/\/\/\s?/, ''))
      continue
    }
    if (!line || line.startsWith('//') || line.startsWith('#')) continue

    let m = line.match(/^enum\s+(\w+)\s*\{?$/)
    if (m) {
      current = { kind: 'enum', name: m[1], doc: [...doc], values: [] }
      doc = []
      continue
    }
    m = line.match(/^model\s+(\w+)\s*\{?$/)
    if (m) {
      current = { kind: 'model', name: m[1], doc: [...doc], fields: [], indexes: [], compositeUniques: [], table: m[1] }
      doc = []
      continue
    }
    if (current && line === '}') {
      ;(current.kind === 'enum' ? enums : models).push(current)
      current = null
      continue
    }
    if (!current) continue

    if (current.kind === 'enum') {
      const v = line.match(/^(\w+)$/)
      if (v) current.values.push({ name: v[1], doc: [...doc] })
      doc = []
      continue
    }

    // model 属性（@@map / @@id / @@unique / @@index）
    const attr = line.match(/^@@(\w+)\s*\((.*)\)\s*$/)
    if (attr) {
      const [, name, args] = attr
      if (name === 'map') current.table = args.replace(/["']/g, '')
      else if (name === 'id') current.primaryKey = args.replace(/[[\]'\s]/g, '').split(',')
      else if (name === 'index') current.indexes.push(args)
      else if (name === 'unique') current.compositeUniques.push(args)
      doc = []
      continue
    }

    // 字段行：name type attrs?
    const field = line.match(/^(\w+)\s+([A-Za-z_]\w*(?:\[\])?\??)\s*(.*)$/)
    if (field) {
      const [, fname, rawType, rest] = field
      const type = rawType.replace('?', '').replace('[]', '')
      const attrs = rest || ''
      const fieldsArg = attrs.match(/fields:\s*\[([^\]]*)\]/)
      current.fields.push({
        name: fname,
        type,
        isArray: rawType.endsWith('[]'),
        isOptional: rawType.endsWith('?'),
        attrs,
        id: /@id/.test(attrs),
        unique: /@unique/.test(attrs),
        defaultValue: (attrs.match(/@default\(((?:[^()]|\([^()]*\))*)\)/) || [])[1] ?? null,
        map: (attrs.match(/@map\("([^"]+)"\)/) || [])[1] ?? null,
        relation: /@relation\(/.test(attrs)
          ? { target: type, fields: fieldsArg ? fieldsArg[1].replace(/\s/g, '').split(',') : [] }
          : null,
        doc: [...doc],
      })
      doc = []
    }
  }

  // 后处理：类型为其他模型的字段 = 关系导航字段（非数据库列）；
  // 每个模型收集“外键列名集合”（本模型持有方 @relation(fields: [...]) 引用的标量列）。
  const modelNames = new Set(models.map((m) => m.name))
  const enumNames = new Set(enums.map((e) => e.name))
  for (const model of models) {
    model.fkColumns = new Set()
    for (const f of model.fields) {
      f.isNavigation = modelNames.has(f.type) && !PG_TYPES[f.type] && !enumNames.has(f.type)
      if (f.relation?.fields?.length) for (const col of f.relation.fields) model.fkColumns.add(col)
    }
  }
  return { enums, models }
}

// ---------- 生成 Mermaid ERD ----------
function mermaidType(t, enumNames) {
  if (MERMAID_TYPES[t]) return MERMAID_TYPES[t]
  if (enumNames.has(t)) return t.toLowerCase() + '_enum'
  return t.toLowerCase()
}

function columnOf(model, fieldName) {
  const f = model.fields.find((x) => x.name === fieldName)
  return f ? (f.map ?? f.name) : fieldName
}

function buildErd({ models, enums }) {
  const enumNames = new Set(enums.map((e) => e.name))
  const out = []
  out.push('---')
  out.push('title: 薪火平台数据库 ER 图（由 prisma/schema.prisma 生成）')
  out.push('---')
  out.push('erDiagram')
  for (const model of models) {
    out.push(`    ${model.table} {`)
    for (const f of model.fields) {
      if (f.isNavigation) continue // 导航字段不进实体框，关系由连线表达
      const keys = []
      if (f.id || model.primaryKey?.includes(f.name)) keys.push('PK')
      if (f.unique) keys.push('UK')
      if (model.fkColumns.has(f.name)) keys.push('FK')
      const comment = f.doc[0] ?? FIELD_NOTES[`${model.name}.${f.name}`] ?? ''
      const suffix = comment ? ` "${comment.replace(/"/g, "'").replace(/\s*，?$/, '')}"` : ''
      const keyStr = keys.length ? ' ' + [...new Set(keys)].join(',') : ''
      out.push(`        ${mermaidType(f.type, enumNames)} ${f.map ?? f.name}${keyStr}${suffix}`)
    }
    out.push('    }')
  }
  // 关系连线：左侧“一”端 = 被引用表（target），右侧“多/一”端 = 持有外键的表（model）
  out.push()
  for (const model of models) {
    for (const f of model.fields) {
      if (!f.relation?.fields?.length) continue
      const target = models.find((m) => m.name === f.relation.target)
      if (!target) continue
      const inverse = target.fields.find((rf) => rf.type === model.name && rf.isNavigation)
      const oneToMany = Boolean(inverse?.isArray)
      const fkCol = f.relation.fields.map((c) => columnOf(model, c)).join('+')
      const left = f.isOptional ? '|o' : '||' // 每“多”端行对应零或一 / 恰一 个“一”端行
      const right = oneToMany ? 'o{' : inverse?.isOptional ? 'o|' : '||'
      out.push(`    ${target.table} ${left}--${right} ${model.table} : "${fkCol}"`)
    }
  }
  // 多态引用（无数据库外键，逻辑关联以虚线表达）
  out.push()
  out.push('    %% 多态目标引用：不设数据库外键，读取时联表过滤（术语见 GLOSSARY「多态目标」）')
  out.push('    craft_item |o..o{ behavior_event : "target_type=CRAFT_ITEM（无外键）"')
  out.push('    course |o..o{ behavior_event : "target_type=COURSE（无外键）"')
  out.push('    post |o..o{ behavior_event : "target_type=POST（无外键）"')
  out.push('    comment |o..o{ behavior_event : "target_type=COMMENT（无外键）"')
  out.push('    craft_item |o..o{ recommendation : "craft_item_id（无外键，与 course_id 二选一）"')
  out.push('    course |o..o{ recommendation : "course_id（无外键，与 craft_item_id 二选一）"')
  return out.join('\n') + '\n'
}

// ---------- 生成数据字典 ----------
function prettyDefault(v) {
  if (v === null) return null
  if (v === '"[]"') return '[]（空数组）'
  return v.replace(/^"|"$/g, '')
}

function buildDictionary({ models, enums }) {
  const out = []
  const P = (s = '') => out.push(s)

  P('# 薪火平台数据字典')
  P()
  P('> 由 `docs/report-assets/database/generate.mjs` 从 `prisma/schema.prisma` 自动生成（重生成：')
  P('> `node docs/report-assets/database/generate.mjs`）。对应报告 4.6.1「实体表设计」与 4.6.2「索引设计」素材。')
  P('> 术语以根目录 GLOSSARY.md 为准；类型为 Prisma 字段映射到 PostgreSQL 之后的实际类型。')
  P()
  P('## 4.6.1 实体表')
  P()
  P(`共 ${models.length} 张实体表。「列名」为数据库实际列名（Prisma @map 映射后的 snake_case）。`)
  P()

  for (const model of models) {
    P(`### ${model.table} —— ${CHINESE[model.name] ?? model.name}`)
    P()
    if (model.doc.length) {
      P(`> ${model.doc.join(' ')}`)
      P()
    }
    P('| 列名 | Prisma 字段 | 类型（PostgreSQL） | 约束 | 说明 |')
    P('| --- | --- | --- | --- | --- |')
    for (const f of model.fields) {
      if (f.isNavigation) continue // 关系导航字段不是数据库列
      const col = f.map ?? f.name
      let pgType
      if (model.fkColumns.has(f.name)) {
        const owning = model.fields.find((rf) => rf.relation?.fields?.includes(f.name))
        const targetModel = models.find((m) => m.name === owning?.relation?.target)
        const targetPk = targetModel?.fields.find((tf) => tf.id)
        pgType = targetPk ? PG_TYPES[targetPk.type] ?? targetPk.type : '见目标表'
      } else if (PG_TYPES[f.type]) {
        pgType = PG_TYPES[f.type]
      } else {
        pgType = enums.some((e) => e.name === f.type) ? `enum ${f.type}` : f.type
      }
      const constraints = []
      if (f.id) constraints.push('主键' + (f.defaultValue?.includes('autoincrement') ? '（自增）' : ''))
      if (!f.id && model.primaryKey?.includes(f.name)) constraints.push('联合主键')
      if (f.unique) constraints.push('唯一')
      if (model.fkColumns.has(f.name)) {
        const owning = model.fields.find((rf) => rf.relation?.fields?.includes(f.name))
        const targetModel = models.find((m) => m.name === owning?.relation?.target)
        const onDelete = (owning?.attrs.match(/onDelete:\s*(\w+)/) || [])[1]
        constraints.push(`外键 → ${targetModel?.table ?? owning?.relation?.target}.${targetPkName(targetModel)}`)
        if (f.isOptional) constraints.push('可空')
        if (onDelete) constraints.push(`ON DELETE ${onDelete.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()}`)
      } else if (f.isOptional) {
        constraints.push('可空')
      }
      const dv = prettyDefault(f.defaultValue)
      if (dv && !dv.includes('autoincrement')) constraints.push(`默认 ${dv}`)
      const note = f.doc[0] ?? FIELD_NOTES[`${model.name}.${f.name}`] ?? ''
      P(`| \`${col}\` | \`${f.name}\` | ${pgType} | ${constraints.join('，') || '—'} | ${note.replace(/\|/g, '\\|') || '—'} |`)
    }
    P()

    // 索引与唯一约束
    const idx = []
    const fieldUniques = model.fields.filter((f) => f.unique).map((f) => `唯一 (${f.map ?? f.name})`)
    const toColumns = (args) =>
      args
        .replace(/[[\]']/g, '')
        .split(',')
        .map((s) => columnOf(model, s.trim()))
        .join(', ')
    for (const args of model.indexes) idx.push(toColumns(args))
    for (const args of model.compositeUniques) idx.push(`唯一 ${toColumns(args)}`)
    if (idx.length + fieldUniques.length > 0) {
      P(`**索引与唯一约束**：${[...fieldUniques, ...idx].map((s) => `\`${s}\``).join('、')}`)
      P()
    }
  }

  P('## 枚举类型')
  P()
  for (const en of enums) {
    P(`### ${en.name}${en.doc.length ? ` —— ${en.doc.join(' ')}` : ''}`)
    P()
    for (const v of en.values) P(`- \`${v.name}\`${v.doc.length ? `：${v.doc.join(' ')}` : ''}`)
    P()
  }

  P('## 4.6.2 索引设计汇总')
  P()
  P('| 表 | 索引 | 设计意图 |')
  P('| --- | --- | --- |')
  const intent = {
    'craft_item (status, subcategory)': '列表页默认「已发布」过滤 + 子类别筛选的组合条件，覆盖首页/列表高频查询',
    'course (craft_item_id, status)': '条目页「相关课程」按条目取已发布课程',
    'course (author_id)': '传承人 /studio 课程列表按作者查询',
    'behavior_event (user_id, type)': '画像管道按用户聚合五类事件（工单 #8）',
    'behavior_event (type, target_id)': '簇内热度统计按「事件类型 + 目标」聚合浏览/学习次数',
    'learning_record (step_id)': '按步骤统计完成人数；联合主键 (user_id, step_id) 已覆盖按用户查进度',
    'post (status, created_at)': '交流区列表按「可见 + 时间倒序」查询',
    'comment (post_id, status)': '帖子详情按帖子取可见评论',
    'comment (author_id)': '按作者查评论',
    'learner_profile (cluster_index)': '管理端画像统计按簇分组计数',
    'recommendation (user_id, score)': '推荐流按用户取分值倒序前列',
  }
  for (const model of models) {
    for (const args of model.indexes) {
      const cols = args
        .replace(/[[\]']/g, '')
        .split(',')
        .map((s) => columnOf(model, s.trim()))
        .join(', ')
      const key = `${model.table} (${cols})`
      P(`| ${model.table} | \`${cols}\` | ${intent[key] ?? '—'} |`)
    }
  }
  P()
  P('> 唯一约束补充：user.username、craft_item.name、tag.name（单列唯一）；')
  P('> inheritor(craft_item_id, name)、step(course_id, order)（复合唯一）；')
  P('> craft_item_tag(craft_item_id, tag_id)、learning_record(user_id, step_id)、learner_profile(user_id)（复合主键兼唯一）。')
  P()

  return out.join('\n')
}

function targetPkName(targetModel) {
  const pk = targetModel?.fields.find((tf) => tf.id)
  return pk ? (pk.map ?? pk.name) : 'id'
}

// ---------- 主流程 ----------
const source = fs.readFileSync(SCHEMA, 'utf8')
const parsed = parseSchema(source)
const erd = buildErd(parsed)
const dict = buildDictionary(parsed)
fs.writeFileSync(path.join(HERE, 'erd.mmd'), erd)
fs.writeFileSync(path.join(HERE, 'data-dictionary.md'), dict)
console.log(`[generate] 解析 ${parsed.models.length} 个模型 / ${parsed.enums.length} 个枚举`)
console.log(`[generate] 写出 erd.mmd（${erd.split('\n').length} 行）与 data-dictionary.md（${dict.split('\n').length} 行）`)
console.log('[generate] 渲染 SVG：docker run --rm -v "$PWD":/data minlag/mermaid-cli mmdc -i /data/erd.mmd -o /data/erd.svg（见 README.md）')
