<template>
  <div class="flex min-h-screen flex-col">
    <!-- 认证区块（登录态/登出）在 AppHeader 内，auth-area 锚点亦在其模板中 -->
    <AppHeader />

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
      薪火 · 非遗传统技艺数字化展示与学习平台（课程实践项目）
    </footer>
  </div>
</template>
