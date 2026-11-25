#!/usr/bin/env node
/**
 * AgentWorks 跨平台工作区自查工具（快慢双档）。
 * 用法：
 *   node _tools/lint.mjs                 # 全盘深度自查
 *   node _tools/lint.mjs --fast          # 秒级快检（查当前变更文件 + 看板）
 *   node _tools/lint.mjs --fast --staged # git pre-commit 钩子模式（拦截凭据/key/>100MB文件）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const stagedOnly = args.includes('--staged');
const getNum = (flag, def) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? Number(args[idx + 1]) || def : def;
};
const bigGB = getNum('--big-gb', 1);
const stagedMaxMB = getNum('--staged-max-mb', 100);

const allowFile = path.join(__dirname, 'lint-allow.txt');
const allowList = fs.existsSync(allowFile)
  ? fs
      .readFileSync(allowFile, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'))
  : [];

let issues = 0;
let blockers = 0;

function isAllowed(msg) {
  const norm = msg.replace(/\\/g, '/');
  return allowList.some((a) => {
    const pat = a.replace(/\\/g, '/').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${pat}`).test(norm);
  });
}

function warn(msg) {
  if (isAllowed(msg)) return;
  issues++;
  console.log(`  ! ${msg}`);
}

function block(msg) {
  if (isAllowed(msg)) return;
  blockers++;
  issues++;
  console.error(`  [阻断] ${msg}`);
}

const credPattern = /((^|[._-])(cookies?|tokens?|secrets?|credentials?|passwords?|passwd)([._-]|$)|^\.env(\..+)?$|\.(pem|key)$)/i;
const skipDirs = new Set([
  'node_modules', '.git', '.venv', 'venv', 'site-packages',
  '__pycache__', '.worktrees', '.cache', 'dist', 'build', '.secrets',
]);
const skipExt = new Set([
  '.py', '.js', '.mjs', '.cjs', '.ts', '.md', '.pyc', '.map', '.d.ts',
  '.png', '.jpg', '.svg', '.go', '.rs', '.example', '.sample', '.template',
]);
const keyPattern = /["'](sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})["']/;
const codeExt = new Set(['.py', '.js', '.mjs', '.ts', '.ps1', '.sh']);

function checkHardcodedKey(fullPath) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (keyPattern.test(lines[i])) return i + 1;
  }
  return 0;
}

function checkBoard() {
  console.log('== 看板占用登记');
  const boardFile = path.join(root, '_board.md');
  if (!fs.existsSync(boardFile)) return;
  const lines = fs.readFileSync(boardFile, 'utf8').split(/\r?\n/);
  let inProgress = false;
  let count = 0;
  for (const line of lines) {
    if (/^## 进行中/.test(line)) {
      inProgress = true;
      continue;
    }
    if (/^## /.test(line)) inProgress = false;
    if (inProgress && line.startsWith('|') && !/^\|\s*(项目|---)/.test(line)) {
      count++;
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
      const dt = new Date((cells[3] || '').replace(' ', 'T'));
      if (!Number.isNaN(dt.getTime()) && (Date.now() - dt.getTime()) / 3600000 > 24) {
        warn(`过期登记（超过 24 小时）：${line}`);
      } else {
        console.log(`  · ${line}`);
      }
    }
  }
  if (count === 0) console.log('  （空闲）');
}

function gitLines(gitArgs) {
  try {
    const out = execFileSync('git', ['-C', root, '-c', 'core.quotepath=false', ...gitArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function inSkippedDir(relPosix) {
  return relPosix.split('/').some((seg) => skipDirs.has(seg));
}

if (fast) {
  console.log(`== AgentWorks ${stagedOnly ? '快检（仅暂存区）' : '快检（当前变更）'}`);
  const relFiles = stagedOnly
    ? gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : gitLines(['status', '--porcelain'])
        .filter((l) => l.length > 3 && !l.slice(0, 2).includes('D'))
        .map((l) => l.slice(3).replace(/^"|"$/g, ''));

  const touchedProjects = new Set();

  for (const rf of relFiles) {
    const relPosix = rf.replace(/\\/g, '/');
    const full = path.join(root, ...relPosix.split('/'));
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    const segs = relPosix.split('/');
    if (segs.length >= 2 && !/^[_.]/.test(segs[0])) {
      touchedProjects.add(`${segs[0]}/${segs[1]}`);
    }

    const base = path.basename(full);
    const ext = path.extname(full).toLowerCase();

    if (credPattern.test(base) && !inSkippedDir(relPosix) && !skipExt.has(ext)) {
      block(`疑似凭据：${relPosix}`);
    }
    if (codeExt.has(ext) && !inSkippedDir(relPosix)) {
      const hitLine = checkHardcodedKey(full);
      if (hitLine > 0) block(`代码硬编码 key：${relPosix}:${hitLine}`);
    }
    if (stagedOnly && stat.size > stagedMaxMB * 1024 * 1024) {
      block(`暂存区超大文件（>${stagedMaxMB}MB）：${relPosix} (${(stat.size / 1048576).toFixed(1)} MB)`);
    }
    const jm = relPosix.match(/^[^_.].*\/journal\/([^/]+\.md)$/);
    if (jm) {
      const jn = jm[1];
      if (jn !== 'README.md' && !/^archive-/.test(jn) && !/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(jn)) {
        warn(`${relPosix} 命名应为 YYYY-MM-DD-agent名.md`);
      }
    }
  }

  if (touchedProjects.size > 0) {
    console.log('== 变更涉及的项目交接文件');
    for (const tp of touchedProjects) {
      const pDir = path.join(root, ...tp.split('/'));
      if (!fs.existsSync(pDir) || !fs.statSync(pDir).isDirectory()) continue;
      if (!fs.existsSync(path.join(pDir, 'AGENTS.md'))) warn(`${tp} 缺 AGENTS.md`);
      if (!fs.existsSync(path.join(pDir, 'journal'))) warn(`${tp} 缺 journal/`);
    }
  }

  checkBoard();
  console.log('');
  if (blockers > 0) {
    console.error(`阻断：${blockers} 条安全/大文件问题需先处理（共 ${issues} 条提醒）`);
    process.exit(1);
  }
  console.log(issues > 0 ? `快检完成：0 阻断，${issues} 条提醒` : '快检全部通过');
  process.exit(0);
}

// ---- 全盘深度自查模式 ----
function walkFiles(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, onFile);
    else if (entry.isFile()) onFile(full);
  }
}

const projects = [];
for (const dom of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dom.isDirectory() || /^[_.]/.test(dom.name)) continue;
  const domPath = path.join(root, dom.name);
  for (const p of fs.readdirSync(domPath, { withFileTypes: true })) {
    if (p.isDirectory()) projects.push({ rel: `${dom.name}/${p.name}`, full: path.join(domPath, p.name) });
  }
}

console.log('== 交接文件');
for (const p of projects) {
  if (!fs.existsSync(path.join(p.full, 'AGENTS.md'))) warn(`${p.rel} 缺 AGENTS.md`);
  const jDir = path.join(p.full, 'journal');
  if (!fs.existsSync(jDir)) {
    warn(`${p.rel} 缺 journal/`);
    continue;
  }
  for (const f of fs.readdirSync(jDir)) {
    if (!f.endsWith('.md')) continue;
    if (f !== 'README.md' && !/^archive-/.test(f) && !/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)) {
      warn(`${p.rel}/journal/${f} 命名应为 YYYY-MM-DD-agent名.md`);
    }
  }
}

console.log('== 疑似凭据与硬编码 key');
for (const p of projects) {
  walkFiles(p.full, (full) => {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const base = path.basename(full);
    const ext = path.extname(full).toLowerCase();
    if (credPattern.test(base) && !skipExt.has(ext)) block(`疑似凭据：${rel}`);
    if (codeExt.has(ext)) {
      const hitLine = checkHardcodedKey(full);
      if (hitLine > 0) block(`代码硬编码 key：${rel}:${hitLine}`);
    }
    const stat = fs.statSync(full);
    if (stat.size > bigGB * 1024 ** 3) {
      warn(`大于 ${bigGB}GB 文件：${rel} (${(stat.size / 1024 ** 3).toFixed(1)} GB)`);
    }
  });
}

checkBoard();
console.log('');
if (blockers > 0) {
  console.error(`共 ${issues} 条提醒（含 ${blockers} 条安全阻断项）`);
  process.exit(1);
}
console.log(issues > 0 ? `共 ${issues} 条提醒` : '全部通过');
