import { existsSync, readFileSync } from 'node:fs'

/**
 * 极简 .env 加载器（无第三方依赖）：Prisma 7 CLI 不再自动加载 .env，
 * 而 seed 脚本经 tsx 运行、生产容器内也无 .env（环境变量由 compose 注入），
 * 因此由这里统一补载；已存在的环境变量优先，不会被 .env 覆盖。
 * 仅支持本项目自有的 .env 格式：KEY=VALUE、# 注释、成对引号。
 */
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}
