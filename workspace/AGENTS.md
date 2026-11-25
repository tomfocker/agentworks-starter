# AgentWorks 工作区约定

所有 AI Agent（Claude Code / Codex / Cursor / Antigravity / ZCode / WorkBuddy 等）在本工作区干活前必读。

## 目录规则
- **两层结构：领域 / 项目**。第一层是领域（如 `代码开发/`、`内容创作/`、`研究学习/`、`个人事务/`，按需增删）；第二层是项目，一个项目一个文件夹，推荐命名「类型-主题」（如 `工具-数据看板`、`短片-产品介绍`）。
- 根目录只放约定、看板和公共设施：`AGENTS.md`、`_board.md`、`_journal/`、`_template/`、`_tools/`，**不在根目录放项目产出**。
- `代码开发/` 下自带 `.git` 的项目仓库：
  1. 在本工作区 `.gitignore` 末尾排除 `代码开发/<项目>/`，避免嵌套仓库被外层收编；
  2. 将工作区交接文件（如 `AGENTS.md`、`journal/`）写入该项目自身的 `.git/info/exclude`，避免提交到它的远端（若仓库本身已有 `AGENTS.md` 则不动，只排 `journal/`）。
- `_tools/` 只放工作区自身的管理脚本（`new-project.mjs`、`board.mjs`、`lint.mjs`）；业务工具算独立项目，放 `代码开发/`；可复用流程优先沉淀为 Skill。
- 工作区级别的改动（约定、看板、工具）记在根目录 `_journal/`，命名同项目 journal。
- 新项目用 `node _tools/new-project.mjs --domain <领域> --name <类型-主题>` 创建；子目录按实际交付物现建（如 `docs/`、`assets/`、`scripts/`、`out/`）并记入项目 `AGENTS.md`。
- 临时文件统一放项目内的 `tmp/`。

## 在哪里干活
- **进入对应项目子目录再干活**：开工第一步先 `cd` 进目标项目目录，渲染与产出落在该目录内。
- 若从根目录启动，先确认要做哪个项目（可查看 `_board.md`），不要直接在根目录生成业务文件。
- 只读写自己负责项目目录内的文件，**绝不跨项目修改**；确实需要跨项目引用时先向用户确认。

## 协作与交接
- 接手项目先读三件套：**本文件 → 项目 `AGENTS.md`（重点看「活跃决策与阻塞项」）→ `journal/` 最新 3 条**。
- **journal 一人一天一文件**，命名 `YYYY-MM-DD-agent名.md`。只往自己的文件追加，固定写清：**做了什么 + 遗留问题 + 下一步**。
- 项目 `AGENTS.md` 的「分工与进度」只改自己那一行；「活跃决策与阻塞项」只留当前仍生效的硬结论与阻塞，解决即删（避免跨天只读最新 3 条 journal 漏掉早期拍板）。
- **打破软件私有记忆孤岛**：凡是换了别的 Agent 也必须知道的硬结论或踩坑，同步写进项目 `AGENTS.md` 或对应 Skill，不要只留在某一款软件的私有记忆里。

### 多 Agent 并行协作
1. **开工先占坑**：`node _tools/board.mjs claim --project <项目> --agent <agent> --scope <子目录> --task "<内容>"`（自动检测冲突并写时间戳）。
2. **收工必释放**：`node _tools/board.mjs release --project <项目> --agent <agent>`，并同步更新项目 `AGENTS.md` 状态。清理超 24 小时僵尸占位用 `node _tools/board.mjs prune`。
3. **看到别人占着就不碰**：同项目同子目录已有未过期（≤24h）登记时，换子目录干或先询问用户；超时 24h 可接手并在 journal 注明。
4. **按子目录分工 / worktree 隔离**：不同 Agent 负责不同子目录；确需修改同一批文件时，使用 `git worktree add ../_wt/<项目>-<agent> -b <agent>/<项目>` 隔离分支。
5. **按项目路径提交**：`git add <本项目路径>` 后 commit，提交信息格式 `[项目] agent: 做了什么`，禁止无脑 `git add -A`。

## 安全边界
- 密钥、凭据、Cookie、浏览器 Profile 优先放用户级目录（如 `~/.config/`、`%APPDATA%`）；项目专用密钥必须放项目内 `.secrets/`（已由 `.gitignore` 排除），严禁硬编码。
- **底线：凭据绝不提交 Git，也不贴入 journal 或对话。**
- 收工前可运行 `node _tools/lint.mjs --fast` 秒级自查；全盘深度体检运行 `node _tools/lint.mjs`。
- 仓库 `.git/hooks/pre-commit` 已接入 `lint.mjs --fast --staged`，命中疑似凭据、硬编码 Key 或 >100MB 误暂存大文件会自动阻断提交；确认无误的例外写入 `_tools/lint-allow.txt` 并注明原因。

## 技能与全局规则同步
- **技能回流**：技能由 Skills Manager 统一管理；修改 Git 来源的技能并需长期保留时，先征得用户确认，再改对应来源仓库 → commit & push → 仅对改动技能执行 `skills update <名字>`。
- **全局规则同步**：本机多客户端全局规则统一在 `~/.aiglobal/.rulesync/rules/` 维护，通过 `rulesync generate` 一键同步（只同步 `rules`，不碰 `skills`）。
