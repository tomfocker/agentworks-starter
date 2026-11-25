#!/usr/bin/env node
/**
 * AgentWorks 跨平台看板 CLI（读写根目录 _board.md 的「进行中」表）。
 * 用法：
 *   node _tools/board.mjs status
 *   node _tools/board.mjs claim --project <项目> --agent <agent> --scope <子目录> --task "<内容>" [--force]
 *   node _tools/board.mjs release --project <项目> [--agent <agent>] [--scope <子目录>]
 *   node _tools/board.mjs prune [--hours 24] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const boardPath = path.join(root, '_board.md');

const args = process.argv.slice(2);
const action = args[0] && !args[0].startsWith('-') ? args[0] : 'status';

function getArg(flag, fallback = '') {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
}
const hasFlag = (flag) => args.includes(flag);

const hours = Number(getArg('--hours', '24')) || 24;

if (!fs.existsSync(boardPath)) {
  console.error(`找不到看板文件: ${boardPath}`);
  process.exit(1);
}

function parseDate(str) {
  const normalized = str.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseBoard() {
  const lines = fs.readFileSync(boardPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
  let startIdx = -1;
  let sepIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (/^## 进行中/.test(lines[i])) {
      startIdx = i;
      continue;
    }
    if (startIdx >= 0 && sepIdx < 0 && /^\|\s*---/.test(lines[i])) {
      sepIdx = i;
      continue;
    }
    if (startIdx >= 0 && i > startIdx && /^## /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  if (startIdx < 0 || sepIdx < 0) {
    throw new Error('_board.md 缺少「## 进行中」表格结构');
  }

  const now = Date.now();
  const rows = [];
  for (let i = sepIdx + 1; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || /^\|\s*(项目|---)/.test(line)) continue;
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((s) => s.trim());
    if (cells.length >= 5) {
      const dt = parseDate(cells[3]);
      const ageHours = dt ? (now - dt.getTime()) / 3600000 : 0;
      rows.push({
        project: cells[0],
        agent: cells[1],
        scope: cells[2],
        started: cells[3],
        task: cells[4],
        ageHours,
        expired: Boolean(dt && ageHours > hours),
      });
    }
  }
  return { lines, sepIdx, endIdx, rows };
}

function saveBoard(parsed, rows) {
  const out = [
    ...parsed.lines.slice(0, parsed.sepIdx + 1),
    ...rows.map((r) => `| ${r.project} | ${r.agent} | ${r.scope} | ${r.started} | ${r.task} |`),
    '',
    ...parsed.lines.slice(parsed.endIdx),
  ];
  const text = out.join('\n').replace(/\n+$/, '') + '\n';
  fs.writeFileSync(boardPath, text, 'utf8');
}

function scopesOverlap(a, b) {
  const norm = (s) => s.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb || na === '*' || nb === '*' || na === '全项目' || nb === '全项目') return true;
  const partsA = na.split(/[、,，]\s*/);
  const partsB = nb.split(/[、,，]\s*/);
  for (const pa of partsA) {
    for (const pb of partsB) {
      if (pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`)) return true;
    }
  }
  return false;
}

const b = parseBoard();

if (action === 'status') {
  if (b.rows.length === 0) {
    console.log('看板空闲：当前无进行中登记。');
    process.exit(0);
  }
  let expiredCount = 0;
  for (const r of b.rows) {
    if (r.expired) {
      expiredCount++;
      console.log(`  [过期 ${Math.round(r.ageHours)}h] ${r.project} | ${r.agent} | ${r.scope} | ${r.started} | ${r.task}`);
    } else {
      console.log(`  [活跃] ${r.project} | ${r.agent} | ${r.scope} | ${r.started} | ${r.task}`);
    }
  }
  console.log(`共 ${b.rows.length} 条进行中（其中 ${expiredCount} 条超过 ${hours} 小时）`);
} else if (action === 'claim') {
  const project = getArg('--project');
  const agent = getArg('--agent');
  const scope = getArg('--scope');
  const task = getArg('--task');
  const force = hasFlag('--force');

  if (!project || !agent || !scope || !task) {
    console.error('claim 需要提供 --project --agent --scope --task');
    process.exit(1);
  }
  const activeConflicts = b.rows.filter(
    (r) => r.project === project && scopesOverlap(r.scope, scope) && !r.expired && r.agent !== agent
  );
  if (activeConflicts.length > 0 && !force) {
    for (const c of activeConflicts) {
      console.error(`冲突: ${c.agent} 正在占用 ${c.project} / ${c.scope}（始于 ${c.started}）: ${c.task}`);
    }
    console.error('请换子目录干活，或确认后加 --force 强制接手。');
    process.exit(1);
  }

  const kept = b.rows.filter((r) => {
    const isSame = r.project === project && scopesOverlap(r.scope, scope);
    return !(isSame && (r.agent === agent || r.expired || force));
  });
  const nowStr = formatNow();
  const clean = (s) => s.replaceAll('|', '/');
  kept.push({
    project: clean(project),
    agent: clean(agent),
    scope: clean(scope),
    started: nowStr,
    task: clean(task),
  });
  saveBoard(b, kept);
  console.log(`已登记: ${project} | ${agent} | ${scope} | ${nowStr} | ${task}`);
} else if (action === 'release') {
  const project = getArg('--project');
  const agent = getArg('--agent');
  const scope = getArg('--scope');
  if (!project && !agent) {
    console.error('release 至少需要提供 --project 或 --agent');
    process.exit(1);
  }
  const kept = [];
  const removed = [];
  for (const r of b.rows) {
    const ok = (!project || r.project === project) && (!agent || r.agent === agent) && (!scope || r.scope === scope);
    if (ok) removed.push(r);
    else kept.push(r);
  }
  if (removed.length === 0) {
    console.log('未找到匹配的进行中登记。');
    process.exit(0);
  }
  saveBoard(b, kept);
  for (const r of removed) {
    console.log(`已释放: ${r.project} | ${r.agent} | ${r.scope}`);
  }
} else if (action === 'prune') {
  const dryRun = hasFlag('--dry-run');
  const kept = [];
  const pruned = [];
  for (const r of b.rows) {
    if (r.expired) pruned.push(r);
    else kept.push(r);
  }
  if (pruned.length === 0) {
    console.log(`没有超过 ${hours} 小时的过期登记。`);
    process.exit(0);
  }
  for (const r of pruned) {
    const tag = dryRun ? '[预览清理]' : '[已清理]';
    console.log(`${tag} ${r.project} | ${r.agent} | ${r.scope} | ${r.started}（超期 ${Math.round(r.ageHours)}h）`);
  }
  if (!dryRun) {
    saveBoard(b, kept);
    console.log(`共清理 ${pruned.length} 条过期登记。`);
  }
} else {
  console.error(`未知动作: ${action}（支持 status / claim / release / prune）`);
  process.exit(1);
}
