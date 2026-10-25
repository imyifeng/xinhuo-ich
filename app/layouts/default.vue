<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <NuxtLink to="/" class="flex items-baseline gap-2">
          <span class="text-xl font-bold tracking-wide">薪火</span>
          <span class="text-sm text-stone-400">Xinhuo · ICH</span>
        </NuxtLink>
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/" class="text-stone-600 transition hover:text-orange-600">首页</NuxtLink>
          <NuxtLink to="/craft-items" class="text-stone-600 transition hover:text-orange-600">技艺条目</NuxtLink>
          <!-- auth-area -->
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
      薪火 · 非遗传统技艺数字化展示与学习平台（课程实践项目）
    </footer>
  </div>
</template>
