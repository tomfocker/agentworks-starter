#!/usr/bin/env node
/**
 * 从 _template 新建项目，并在 _board.md 的「项目一览」登记。
 * 用法：node _tools/new-project.mjs --domain 代码开发 --name 工具-示例项目 [--note "备注"]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : '';
}

const domain = getArg('--domain');
const name = getArg('--name');
const note = getArg('--note');

if (!domain || !name) {
  console.error('用法: node _tools/new-project.mjs --domain <领域> --name <类型-主题> [--note "备注"]');
  process.exit(1);
}
if (/\s/.test(name)) {
  console.error(`项目名不要带空格: ${name}`);
  process.exit(1);
}
if (!/^[^-]+-.+/.test(name)) {
  console.warn(`提示: 项目名建议用「类型-主题」格式，例如 工具-示例项目（当前: ${name}）`);
}

const domainDir = path.join(root, domain);
if (!fs.existsSync(domainDir)) {
  const existing = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name))
    .map((d) => d.name)
    .join('、');
  console.warn(`提示: 领域「${domain}」不存在，将新建。现有领域: ${existing || '（暂无）'}`);
  fs.mkdirSync(domainDir, { recursive: true });
}

const dst = path.join(domainDir, name);
if (fs.existsSync(dst)) {
  console.error(`项目已存在: ${dst}`);
  process.exit(1);
}

fs.cpSync(path.join(root, '_template'), dst, { recursive: true });

const agentsPath = path.join(dst, 'AGENTS.md');
const content = fs.readFileSync(agentsPath, 'utf8').replaceAll('<项目名>', name);
fs.writeFileSync(agentsPath, content, 'utf8');

const boardPath = path.join(root, '_board.md');
const row = `| ${domain} | ${name} | 未开始 | ${note} |\n`;
const boardOld = fs.readFileSync(boardPath, 'utf8');
const sep = boardOld.endsWith('\n') ? '' : '\n';
fs.writeFileSync(boardPath, `${boardOld}${sep}${row}`, 'utf8');

console.log(`已创建: ${dst}`);
console.log('下一步: 填写项目 AGENTS.md 的目标与验收标准，然后进入该项目目录启动 Agent。');
