<script setup lang="ts">
/**
 * 全局头部：品牌 + 占位导航 + 认证区块。
 * <!-- auth-area --> 标记为跨工单锚点：登录态 UI（用户名 / 登出）落在此处，
 * 后续工单（T3 行为记录等）在此基础上扩展角色入口。
 */
interface AuthUser {
  id: number
  username: string
  displayName: string
  role: string
}

// 登录态：SSR 阶段即读取（useFetch 自动透传请求 Cookie）。
// key 'auth-me' 供登录/注册/登出后 refreshNuxtData 刷新头部。
const { data: user } = await useFetch<AuthUser | null>('/api/auth/me', {
  key: 'auth-me',
  default: () => null,
})

const loggingOut = ref(false)

async function onLogout() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await refreshNuxtData('auth-me')
  }
  finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <header class="border-b border-stone-200 bg-white">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
      <NuxtLink to="/" class="flex items-baseline gap-2">
        <span class="text-xl font-bold tracking-wide">薪火</span>
        <span class="text-sm text-stone-400">Xinhuo · ICH</span>
      </NuxtLink>

      <nav class="flex items-center gap-3 text-sm text-stone-500">
        <!-- 占位导航：技艺条目 / 课程 / 交流区 由后续工单实现 -->
        <span class="hidden sm:inline">技艺条目</span>
        <span class="hidden text-stone-300 sm:inline">·</span>
        <span class="hidden sm:inline">课程</span>
        <span class="hidden text-stone-300 sm:inline">·</span>
        <span class="hidden sm:inline">交流区</span>

        <!-- auth-area -->
        <span class="mx-1 h-4 w-px bg-stone-200" aria-hidden="true" />
        <template v-if="user">
          <span class="text-stone-700">你好，{{ user.displayName }}</span>
          <button
            class="rounded-lg border border-stone-300 px-3 py-1 transition hover:border-stone-400 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loggingOut"
            @click="onLogout"
          >
            {{ loggingOut ? '登出中…' : '登出' }}
          </button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="transition hover:text-stone-900">
            登录
          </NuxtLink>
          <NuxtLink
            to="/register"
            class="rounded-lg bg-orange-600 px-3 py-1 text-white transition hover:bg-orange-700"
          >
            注册
          </NuxtLink>
        </template>
        <!-- /auth-area -->
      </nav>
    </div>
  </header>
</template>
