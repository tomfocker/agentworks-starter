---
root: true
targets:
  - "*"
---
## 技能改动回流规则
本机技能由 Skills Manager 统一管理：中央库在 `~/.skills-manager/skills/`，各 Agent 目录里的是受管副本，执行 `skills update` 时会被来源仓库版本覆盖。修改技能前先检查其来源。

Git 来源的技能若需长期保留改动：先征得用户确认，再把改动写入对应来源仓库并 `git commit && git push`，最后只对本次改动的技能执行 `skills update <技能名>` 同步至全部客户端。临时性改动无需回流。

## 全局规则同步
本机多客户端全局规则统一由 `~/.aiglobal/.rulesync/rules/` 通过 `rulesync` 生成（只管 `rules`，不碰 `skills`）。如需长期修改全局规则，请编辑源目录后运行 `rulesync generate`，勿直接手改各客户端受管文件。
