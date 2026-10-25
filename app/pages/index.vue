<script setup lang="ts">
interface PlatformStats {
  craftItemCount: number
  categoryCount: number
}

// 首页统计：SSR 阶段即从 /api/stats 读取数据库计数（接入 → 业务 → 数据 三层贯通的可见证明）
const { data: stats } = await useFetch<PlatformStats>('/api/stats')

useHead({
  title: '薪火 · 非遗传统技艺数字化展示与学习平台',
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-stone-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div class="flex items-baseline gap-2">
          <span class="text-xl font-bold tracking-wide">薪火</span>
          <span class="text-sm text-stone-400">Xinhuo · ICH</span>
        </div>
        <nav class="text-sm text-stone-500">
          <!-- 占位导航：技艺条目 / 课程 / 交流区 由后续工单实现 -->
          <span>技艺条目</span>
          <span class="mx-2 text-stone-300">·</span>
          <span>课程</span>
          <span class="mx-2 text-stone-300">·</span>
          <span>交流区</span>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <section class="border-b border-stone-200 bg-gradient-to-b from-orange-50 to-stone-50">
        <div class="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 class="text-4xl font-bold tracking-wide sm:text-5xl">薪火相传</h1>
          <p class="mx-auto mt-5 max-w-2xl leading-relaxed text-stone-600">
            非遗传统技艺数字化展示与学习平台——看懂一门技艺，跟着学一遍。
            收录国家级名录中的传统技艺，提供结构化分步课程与学习者交流社区。
          </p>
        </div>
      </section>

      <section class="mx-auto max-w-5xl px-6 py-14">
        <h2 class="text-lg font-semibold">平台统计</h2>
        <div class="mt-6 grid grid-cols-2 gap-4 sm:gap-6">
          <div class="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <p class="text-4xl font-bold text-orange-600">
              {{ stats?.craftItemCount ?? '—' }}
            </p>
            <p class="mt-2 text-sm text-stone-500">技艺条目</p>
          </div>
          <div class="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <p class="text-4xl font-bold text-orange-600">
              {{ stats?.categoryCount ?? '—' }}
            </p>
            <p class="mt-2 text-sm text-stone-500">覆盖子类别</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
      薪火 · 非遗传统技艺数字化展示与学习平台（课程实践项目）
    </footer>
  </div>
</template>
