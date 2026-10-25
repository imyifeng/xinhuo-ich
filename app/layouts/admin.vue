<script setup lang="ts">
/**
 * 管理后台布局（/admin 专用，工单 #5）：侧边导航（技艺条目/课程审核/传承人/标签/账号）+ 顶栏。
 * 仅需能用，不追求美观（工单约定）；页面全部声明 layout: 'admin' 与 middleware: 'admin'。
 */
const route = useRoute()

// 当前激活菜单：/admin/craft-items → 'craft-items'；/admin → 默认技艺条目
const activeMenu = computed(() => {
  const seg = route.path.replace(/^\/admin\/?/, '').split('/')[0]
  return seg || 'craft-items'
})

async function onLogout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-stone-100">
    <header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
      <div class="flex items-baseline gap-2">
        <NuxtLink to="/" class="text-lg font-bold tracking-wide">薪火</NuxtLink>
        <span class="text-sm text-stone-400">管理后台</span>
      </div>
      <div class="flex items-center gap-3 text-sm text-stone-500">
        <NuxtLink to="/" class="transition hover:text-orange-600">返回前台</NuxtLink>
        <button class="transition hover:text-stone-900" @click="onLogout">登出</button>
      </div>
    </header>

    <div class="flex flex-1">
      <aside class="w-48 shrink-0 border-r border-stone-200 bg-white">
        <el-menu :default-active="activeMenu" router class="border-r-0">
          <el-menu-item index="craft-items" route="/admin/craft-items">技艺条目</el-menu-item>
          <el-menu-item index="courses" route="/admin/courses">课程审核</el-menu-item>
          <el-menu-item index="inheritors" route="/admin/inheritors">传承人</el-menu-item>
          <el-menu-item index="tags" route="/admin/tags">标签</el-menu-item>
          <el-menu-item index="users" route="/admin/users">账号</el-menu-item>
          <el-menu-item index="moderation" route="/admin/moderation">内容审核</el-menu-item>
          <el-menu-item index="profiles" route="/admin/profiles">画像统计</el-menu-item>
        </el-menu>
      </aside>

      <main class="min-w-0 flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
