# 全局规则统一同步模板（`~/.aiglobal/` + `rulesync`）

本目录用于解决**多 AI 客户端全局规则漂移**问题：把你电脑上多个客户端的全局规则统一维护在一个单一数据源（`~/.aiglobal/.rulesync/rules/`），由 [`rulesync`](https://github.com/dyoshikawa/rulesync) 一键分发生成。

## 设计原则

1. **只同步 `rules`，不碰 `skills`**：在 `rulesync.jsonc` 中限定 `"features": ["rules"]`，技能继续交由 Skills Manager 专管，互不覆盖。
2. **用文件名前缀控制拼装顺序，且不覆盖单端专属设定**：
   - `00-*.md`：仅面向单个客户端（通过 `targets: ["codexcli"]` 等限定），保留各客户端独有的语言/记忆/偏好；
   - `10-*.md`、`20-*.md`、`30-*.md`：`targets: ["*"]`，所有客户端共享同一份技能回流规则、工作区入口与本机环境红线。
3. **跨机同步请建私有仓库**：你填入真实路径和个人习惯后的 `~/.aiglobal/` 建议单独建**私有 Git 仓库**保存，不要提交回公开模板仓。

## 快速使用

```bash
# 1. 全局安装 rulesync
npm install -g rulesync

# 2. 复制本模板到用户主目录
cp -r global-rules-template ~/.aiglobal
cd ~/.aiglobal

# 3. 将 .rulesync/rules/*.example.md 去掉 .example 后缀，按实际情况修改
# 4. 在 rulesync.jsonc 中按你实际使用的客户端调整 targets（运行 rulesync docs reference/supported-tools 查看完整列表）

# 5. 先预演，确认目标路径无误后再正式生成
rulesync generate --dry-run
rulesync generate

# 6. 日常校验是否有客户端发生规则漂移
rulesync generate --check
```

## 常见提示

- 若某个客户端目录（如 `~/.codex`）在你的系统里是指向其他磁盘的符号链接 / Junction，`rulesync --global` 出于安全考虑会拒绝穿出用户主目录写入；可以为该客户端单独指定 `--output-roots <真实目录>` 来生成。
- 若使用未在 `rulesync` 内置列表中的客户端，可写一个极简包装脚本，在执行 `rulesync generate` 后把共享规则段同步到对应文件。
