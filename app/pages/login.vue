<script setup lang="ts">
useHead({
  title: '登录 · 薪火',
  htmlAttrs: { lang: 'zh-CN' },
})

const username = ref('')
const password = ref('')
const fieldErrors = ref<{ username?: string, password?: string }>({})
const errorMessage = ref('')
const submitting = ref(false)

// 从注册页跳转过来时给出成功提示
const justRegistered = computed(() => useRoute().query.registered === '1')

function validate(): boolean {
  fieldErrors.value = {}
  if (username.value.trim().length === 0) {
    fieldErrors.value.username = '请输入用户名'
  }
  if (password.value.length === 0) {
    fieldErrors.value.password = '请输入密码'
  }
  return Object.keys(fieldErrors.value).length === 0
}

async function onSubmit() {
  errorMessage.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value.trim(), password: password.value },
    })
    await refreshNuxtData('auth-me')
    await navigateTo('/')
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col">

    <main class="flex flex-1 items-center justify-center px-6 py-16">
      <div class="w-full max-w-sm">
        <h1 class="text-2xl font-bold">登录</h1>
        <p class="mt-2 text-sm text-stone-500">
          还没有账号？
          <NuxtLink to="/register" class="text-orange-600 hover:underline">
            立即注册
          </NuxtLink>
        </p>

        <p
          v-if="justRegistered"
          class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          注册成功，请登录。
        </p>

        <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
          <div>
            <label for="username" class="block text-sm font-medium text-stone-700">用户名</label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="3~30 个字符"
            >
            <p v-if="fieldErrors.username" class="mt-1 text-sm text-red-600">
              {{ fieldErrors.username }}
            </p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-stone-700">密码</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="至少 8 位"
            >
            <p v-if="fieldErrors.password" class="mt-1 text-sm text-red-600">
              {{ fieldErrors.password }}
            </p>
          </div>

          <p
            v-if="errorMessage"
            class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            class="w-full rounded-lg bg-orange-600 py-2 font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="submitting"
          >
            {{ submitting ? '登录中…' : '登录' }}
          </button>
        </form>
      </div>
    </main>

    <footer class="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
      薪火 · 非遗传统技艺数字化展示与学习平台（课程实践项目）
    </footer>
  </div>
</template>
