---
root: true
targets:
  - "*"
---
## AgentWorks 工作区
在 `<你的AgentWorks路径>` 下的任何目录干活时，开工前先读根目录 `AGENTS.md`（工作区总规矩：目录结构、看板登记、journal 交接、安全边界），再读当前项目的 `AGENTS.md`（重点看「活跃决策与阻塞项」）和 `journal/` 最新 3 条。看板登记与释放优先使用 `node _tools/board.mjs`；收工前可用 `node _tools/lint.mjs --fast` 秒级自查。
