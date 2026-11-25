#!/usr/bin/env node
/**
 * 一键初始化本地 AgentWorks 工作区（Windows / macOS / Linux 通用）。
 * 用法：node init.mjs <目标路径> [--no-git]
 * 示例：node init.mjs ~/AgentWorks
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(__dirname, 'workspace');

const args = process.argv.slice(2);
const noGit = args.includes('--no-git');
const targetArg = args.find((a) => !a.startsWith('-'));

if (!targetArg || args.includes('-h') || args.includes('--help')) {
  console.log('用法: node init.mjs <目标工作区路径> [--no-git]');
  console.log('示例: node init.mjs ~/AgentWorks');
  process.exit(targetArg ? 0 : 1);
}

const resolvedTarget = path.resolve(
  targetArg.startsWith('~/') || targetArg === '~'
    ? path.join(os.homedir(), targetArg.slice(1))
    : targetArg
);

if (fs.existsSync(resolvedTarget) && fs.readdirSync(resolvedTarget).length > 0) {
  console.error(`错误: 目标目录已存在且非空: ${resolvedTarget}`);
  process.exit(1);
}

fs.mkdirSync(resolvedTarget, { recursive: true });
fs.cpSync(templateDir, resolvedTarget, { recursive: true });
fs.mkdirSync(path.join(resolvedTarget, '_journal'), { recursive: true });

if (!noGit) {
  try {
    execFileSync('git', ['init', resolvedTarget], { stdio: 'inherit' });
    const hookSrc = path.join(resolvedTarget, '_tools', 'hooks', 'pre-commit');
    const hookDst = path.join(resolvedTarget, '.git', 'hooks', 'pre-commit');
    fs.copyFileSync(hookSrc, hookDst);
    if (process.platform !== 'win32') {
      fs.chmodSync(hookDst, 0o755);
    }
    console.log(`已安装 pre-commit 钩子: ${hookDst}`);
  } catch (err) {
    console.warn(`警告: Git 初始化或钩子安装跳过（${err.message}）`);
  }
}

console.log(`\n初始化完成: ${resolvedTarget}`);
console.log('下一步:');
console.log(`  1. cd "${resolvedTarget}"`);
console.log('  2. node _tools/new-project.mjs --domain 代码开发 --name 工具-首个项目');
console.log('  3. 按 global-rules-template/README.md 配置 ~/.aiglobal 的 rulesync 同步');
