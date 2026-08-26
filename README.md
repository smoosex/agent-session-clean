# AGC

AGC（Agent Session Clean）是一个只读的 Pi 和 Codex session 浏览器，用项目组织并查看本机 session。

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

Codex 默认读取 `~/.codex/sessions`，也会根据 `CODEX_HOME` 读取 `$CODEX_HOME/sessions`。顶部 Agent 选择器可以在 Pi 和 Codex 之间切换。

也可以使用 `agc` 命令：

```bash
bun link
agc
```

## 快捷键

- `↑` / `↓`、`j` / `k`：移动
- `Tab` / `Shift+Tab`：切换焦点
- `1` / `2` / `3`：聚焦项目、session、详情
- `/`：搜索
- `r`：重新扫描
- `s`：切换排序
- `?`：帮助
- `q`：退出

AGC 当前只读，不删除、移动或修改 session 文件，也不会联网。删除能力的统一接口已预留，但尚未启用。Pi 和 Codex 的扫描都只读取本地 JSONL 文件。

## 架构

- `domain/`：Agent 无关的项目、session、扫描、选择和操作类型。
- `application/`：扫描、详情、删除用例，以及 scanner/parser/deleter 统一接口。
- `adapters/`：每个 Agent 自己实现 scanner 和 parser，并按能力提供 deleter。
- `store/`：TUI 状态、焦点、过滤、选择和异步操作状态。
- `components/`：只依赖统一状态和领域模型，不访问文件系统或 Agent 格式。

## 开发

```bash
bun run typecheck
bun test
```
