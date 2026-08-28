# AGC

AGC（Agent Session Clean）是一个 Pi、Claude Code、Antigravity、Codex、Grok 和 OpenCode session 管理器，用项目组织、查看和删除本机 session。

## 运行

```bash
bun install
bun run src/main.tsx
```

覆盖 Pi session 目录：

```bash
bun run src/main.tsx --pi-sessions-dir /path/to/sessions
AGC_PI_SESSIONS_DIR=/path/to/sessions bun run src/main.tsx
```

覆盖 Codex rollout 目录：

```bash
bun run src/main.tsx --codex-sessions-dir /path/to/sessions
AGC_CODEX_SESSIONS_DIR=/path/to/sessions bun run src/main.tsx
```

覆盖 OpenCode 数据目录：

```bash
bun run src/main.tsx --opencode-data-dir /path/to/opencode
AGC_OPENCODE_DATA_DIR=/path/to/opencode bun run src/main.tsx
```

覆盖 Claude Code session 目录：

```bash
bun run src/main.tsx --claude-code-sessions-dir /path/to/projects
AGC_CLAUDE_CODE_SESSIONS_DIR=/path/to/projects bun run src/main.tsx
```

覆盖 Antigravity 数据目录：

```bash
bun run src/main.tsx --antigravity-data-dir /path/to/antigravity-cli
AGC_ANTIGRAVITY_DATA_DIR=/path/to/antigravity-cli bun run src/main.tsx
```

覆盖 Grok session 目录：

```bash
bun run src/main.tsx --grok-sessions-dir /path/to/sessions
AGC_GROK_SESSIONS_DIR=/path/to/sessions bun run src/main.tsx
```

Codex 默认读取 `~/.codex/sessions`，也会根据 `CODEX_HOME` 读取 `$CODEX_HOME/sessions`。OpenCode 默认读取 `~/.local/share/opencode`（可用 `OPENCODE_DATA_DIR` 或 `XDG_DATA_HOME` 覆盖）。Claude Code 默认读取 `~/.claude/projects`（可用 `CLAUDE_CONFIG_DIR` 覆盖配置根目录）。Antigravity 默认读取 `~/.gemini/antigravity-cli`（可用 `GEMINI_HOME` 覆盖配置根目录）。Grok 默认读取 `~/.grok/sessions`（可用 `GROK_HOME` 覆盖配置根目录）。顶部 Agent 选择器可以在已接入的 Agent 之间切换。

也可以使用 `agc` 命令：

```bash
bun link
agc
```

## 快捷键

- `↑` / `↓`、`j` / `k`：移动
- `Tab` / `Shift+Tab`：切换焦点
- `1` / `2` / `3`：聚焦项目、session、详情
- `Space`：在 Session 列表中切换多选状态
- `d`：删除当前 session、已选 session 或当前项目
- `/`：搜索
- `r`：重新扫描
- `s`：切换排序
- `?`：帮助
- `q`：退出

AGC 不联网。删除操作会永久删除 session，无法撤销。Pi、Claude Code 和 Codex 扫描本地 JSONL；Grok 扫描 `summary.json` 并删除整个 session 目录；Antigravity 扫描 `conversation_summaries.db` 并删除对应 conversation 文件；OpenCode 扫描本地 `opencode.db`，删除时会去掉对应数据库行和 `storage` 文件。

## 架构

- `domain/`：Agent 无关的项目、session、扫描、选择和操作类型。
- `application/`：扫描、详情、删除用例，以及 scanner/parser/deleter 统一接口。
- `adapters/`：每个 Agent 自己实现 scanner、parser 和 deleter。
- `store/`：TUI 状态、焦点、过滤、选择和异步操作状态。
- `components/`：只依赖统一状态和领域模型，不访问文件系统或 Agent 格式。

## 开发

```bash
bun run typecheck
bun test
```
