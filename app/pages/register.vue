<script setup lang="ts">
useHead({
  title: '注册 · 薪火',
  htmlAttrs: { lang: 'zh-CN' },
})

const username = ref('')
const displayName = ref('')
const password = ref('')
const fieldErrors = ref<{ username?: string, displayName?: string, password?: string }>({})
const errorMessage = ref('')
const submitting = ref(false)

// 与后端 server/utils/services/auth.service.ts 的校验规则一致（客户端先拦一道，后端仍是权威）
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/

function validate(): boolean {
  fieldErrors.value = {}
  const name = username.value.trim()
  if (!USERNAME_PATTERN.test(name)) {
    fieldErrors.value.username = '用户名需为 3~30 个字符，仅限字母、数字、下划线、连字符'
  }
  const nickname = displayName.value.trim()
  if (nickname.length > 30) {
    fieldErrors.value.displayName = '昵称最多 30 个字符'
  }
  if (password.value.length < 8) {
    fieldErrors.value.password = '密码至少 8 位'
  }
  return Object.keys(fieldErrors.value).length === 0
}

async function onSubmit() {
  errorMessage.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        username: username.value.trim(),
        displayName: displayName.value.trim() || undefined,
        password: password.value,
      },
    })
    // 注册成功不自动登录，引导用户走一遍登录（注册 → 登录为两条独立接口）
    await navigateTo({ path: '/login', query: { registered: '1' } })
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
        <h1 class="text-2xl font-bold">注册</h1>
        <p class="mt-2 text-sm text-stone-500">
          已有账号？
          <NuxtLink to="/login" class="text-orange-600 hover:underline">
            直接登录
          </NuxtLink>
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
              placeholder="3~30 个字符，字母 / 数字 / 下划线 / 连字符"
            >
            <p v-if="fieldErrors.username" class="mt-1 text-sm text-red-600">
              {{ fieldErrors.username }}
            </p>
          </div>

          <div>
            <label for="displayName" class="block text-sm font-medium text-stone-700">
              昵称 <span class="font-normal text-stone-400">（选填）</span>
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="不填则默认为用户名"
            >
            <p v-if="fieldErrors.displayName" class="mt-1 text-sm text-red-600">
              {{ fieldErrors.displayName }}
            </p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-stone-700">密码</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
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
            {{ submitting ? '注册中…' : '注册' }}
          </button>
        </form>
      </div>
    </main>

    <footer class="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
      薪火 · 非遗传统技艺数字化展示与学习平台（课程实践项目）
    </footer>
  </div>
</template>
