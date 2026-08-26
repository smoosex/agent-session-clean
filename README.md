# AGC

AGC（Agent Session Clean）是一个只读的 Pi session 浏览器，用项目组织并查看本机 session。

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

AGC 不删除、移动、修改 session 文件，也不会联网。

## 开发

```bash
bun run typecheck
bun test
```
