import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // /admin 管理后台用 Element Plus 快速搭 CRUD（规格 #1 前端决策），其余页面仍为 Tailwind 手写
  modules: ['@element-plus/nuxt'],

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
})
