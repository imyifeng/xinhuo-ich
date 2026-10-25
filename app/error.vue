<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error.statusCode === 404)

// 薪火全局错误页：中文提示
useHead({ title: '页面未找到 · 薪火', htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-stone-900 antialiased">
    <p class="text-6xl font-bold text-orange-600">{{ error.statusCode }}</p>
    <h1 class="mt-4 text-xl font-semibold">
      {{ isNotFound ? '页面未找到' : '服务出了点问题' }}
    </h1>
    <p class="mt-3 max-w-md text-center text-sm text-stone-500">
      {{ isNotFound
        ? '您访问的技艺条目可能不存在或尚未发布，可以先去条目列表逛逛。'
        : '发生了意外错误，请稍后重试。' }}
    </p>
    <div class="mt-8 flex gap-4">
      <NuxtLink
        to="/"
        class="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-orange-700"
      >
        返回首页
      </NuxtLink>
      <NuxtLink
        to="/craft-items"
        class="rounded-lg border border-stone-300 px-5 py-2.5 text-sm text-stone-600 transition hover:border-orange-400 hover:text-orange-600"
      >
        浏览技艺条目
      </NuxtLink>
    </div>
  </div>
</template>
