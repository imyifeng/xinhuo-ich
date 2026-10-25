<script setup lang="ts">
/**
 * 账号管理（工单 #5）：列表（搜索/角色筛选 + 分页）+ 角色标记（学习者↔传承人↔管理员，含标记传承人）。
 * 角色改动即时生效（服务端按数据库鉴权）。
 */
useHead({ title: '账号管理 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface UserRow {
  id: number
  username: string
  displayName: string
  role: 'LEARNER' | 'INHERITOR' | 'ADMIN'
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = { LEARNER: '学习者', INHERITOR: '传承人', ADMIN: '管理员' }

const list = ref<UserRow[]>([])
const total = ref(0)
const loading = ref(false)
const keyword = ref('')
const roleFilter = ref('')
const page = ref(1)
const pageSize = ref(20)

async function loadList() {
  loading.value = true
  try {
    const query = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) })
    if (keyword.value.trim()) query.set('q', keyword.value.trim())
    if (roleFilter.value) query.set('role', roleFilter.value)
    const body = await $fetch<{ items: UserRow[], total: number }>(`/api/admin/users?${query}`)
    list.value = body.items
    total.value = body.total
  }
  finally {
    loading.value = false
  }
}

function onFilterChange() {
  page.value = 1
  void loadList()
}

async function onRoleChange(row: UserRow, role: string) {
  try {
    await $fetch(`/api/admin/users/${row.id}/role`, { method: 'PUT', body: { role } })
    ElMessage.success(`已将「${row.displayName}」标记为${ROLE_LABELS[role]}`)
    await loadList()
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
    await loadList()
  }
}

onMounted(loadList)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-xl font-bold">账号</h1>
      <el-select v-model="roleFilter" clearable placeholder="全部角色" class="w-36" @change="onFilterChange">
        <el-option label="学习者" value="LEARNER" />
        <el-option label="传承人" value="INHERITOR" />
        <el-option label="管理员" value="ADMIN" />
      </el-select>
      <el-input v-model="keyword" placeholder="按用户名/昵称搜索" clearable class="w-64" @change="onFilterChange" />
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="150" />
      <el-table-column prop="displayName" label="昵称" min-width="140" />
      <el-table-column label="角色" width="200">
        <template #default="{ row }">
          <el-select :model-value="row.role" @change="(role: string) => onRoleChange(row, role)">
            <el-option label="学习者" value="LEARNER" />
            <el-option label="传承人" value="INHERITOR" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      @current-change="loadList"
      @size-change="onFilterChange"
    />
  </div>
</template>
