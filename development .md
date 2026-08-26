# AGC（Agent Session Clean）首版开发文档

## 1. 文档信息

- 产品名称：AGC（Agent Session Clean）
- 当前版本：v0.1
- 文档状态：首版开发设计
- 首版 Agent：Pi、Codex
- 首版能力：只读扫描与展示
- 暂不包含：删除、归档、恢复、Claude Code 和 Antigravity 适配器
- 技术栈：OpenTUI + SolidJS + TypeScript + Bun

## 2. 产品目标

AGC 用于集中查看本机不同 Agent 产生的 session，并按照项目组织这些 session。用户可以先选择 Agent，再选择项目，最后查看该项目中的 session 以及单个 session 的详细信息。

首版只实现可靠、清晰的展示能力，为后续接入 Claude Code、Codex、Antigravity 等 Agent 保留统一的适配器接口。

### 2.1 首版目标

1. 启动后自动发现 Pi 和 Codex session 存储目录。
2. 展示当前 Agent 下的所有项目。
3. 展示选中项目下的所有 session。
4. 展示选中 session 的详细元数据和内容摘要。
5. 支持重新扫描、搜索、排序和键盘导航。
6. 全程只读，不修改任何 session 文件。

### 2.2 非目标

- 不删除任何文件。
- 不移动、重命名或归档 session。
- 不调用 Agent API。
- 不上传数据，不联网，不收集遥测。
- 不在首版实现完整 session 内容编辑器。

## 3. 产品交互设计

### 3.1 主界面

主界面采用单页三栏布局。顶部固定 Agent 选择器，下面依次展示项目、session 和详情。

```text
┌─ AGC · Agent Session Clean ──────────────────────────────────────────────┐
│ Agent  [ ● Pi ▾ ]   ~/.pi/agent/sessions       Scan complete · 184 sessions│
├───────────────────┬──────────────────────────────┬────────────────────────┤
│ Projects          │ Sessions                     │ Session details         │
│                   │                              │                        │
│ ● ~/code/app  42  │ ● Fix authentication        │ Fix authentication      │
│   ~/code/site 18  │   2 hours ago · 156 KB       │                        │
│   ~/work/api  31  │                              │ Project                │
│   ~/lab/demo   7  │   Refactor database         │ ~/code/app             │
│                   │   Yesterday · 2.4 MB         │                        │
│                   │                              │ Updated                │
│                   │   Improve error messages    │ 2 hours ago            │
│                   │   3 days ago · 98 KB         │                        │
│                   │                              │ Messages              │
│                   │                              │ 47                     │
│                   │                              │                        │
│                   │                              │ Last user message      │
│                   │                              │ ...                    │
├───────────────────┴──────────────────────────────┴────────────────────────┤
│ ↑↓ Navigate   Tab Switch pane   / Search   r Refresh   ? Help   q Quit     │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 顶部 Agent 选择器

顶部 Agent 选择器是后续扩展的固定入口，首版不能因为只有 Pi 而省略。

```text
Agent  [ ● Pi ▾ ]
```

下拉选项设计：

| Agent | 首版状态 | 交互表现 |
|---|---|---|
| Pi | 支持 | 可选择、可扫描 |
| Claude Code | 未支持 | 显示 Coming soon，不可选择 |
| Codex | 支持 | 可选择、可扫描 |
| Antigravity | 未支持 | 显示 Coming soon，不可选择 |

未来新增 Agent 时，只新增适配器和注册项，不修改三栏布局。

### 3.3 左栏：项目列表

左栏展示当前 Agent 发现的全部项目，每个项目一行。

每行至少显示：

- 项目显示路径。
- session 数量。
- 项目下 session 总大小。
- 当前选中状态。

默认排序：最近更新时间倒序。后续可增加按名称、session 数量和占用空间排序。

项目路径展示规则：

- 优先使用 session 文件中的 `cwd`。
- 当前工作目录位于用户 Home 下时，使用 `~/` 缩写。
- 中间目录过长时保留首尾，避免隐藏项目名称。
- 无法获取 `cwd` 时显示 `Unknown project`，并在详情中保留原始文件路径。

### 3.4 中栏：Session 列表

中栏只展示左栏选中项目中的 session，不跨项目混合展示。

每个 session 行显示：

- session 标题或自动生成的摘要标题。
- 最近更新时间。
- 文件大小。
- 可选的消息数量。
- 解析警告标记。

默认排序：最近更新时间倒序。

标题生成优先级：

1. session 中明确存在的 title/name 字段。
2. 第一条用户消息的纯文本摘要。
3. `Untitled session`。

列表中不显示复选框，因为首版不包含删除和批量操作。选中行使用明显的背景色或左侧强调线，不使用大面积高亮，避免长列表难以阅读。

### 3.5 右栏：Session 详情

右栏展示中栏当前选中 session 的详细信息。

建议包含：

- 标题。
- session ID。
- 项目路径。
- session 文件路径。
- 创建时间。
- 最近更新时间。
- 文件大小。
- 消息数量。
- 记录数量。
- 使用过的 provider/model（如果可以从记录中解析）。
- 第一条用户消息摘要。
- 最后一条用户消息摘要。
- 解析状态和警告信息。

右栏默认只显示摘要，不直接渲染完整对话内容。这样可以避免长 session 阻塞界面，也避免详情面板变成第二个聊天阅读器。

### 3.6 搜索

按 `/` 打开搜索输入框，搜索范围包括：

- 项目路径。
- session 标题。
- session ID。
- 第一条或最后一条用户消息摘要。

搜索结果同时影响项目列表和 session 列表。搜索为空时恢复完整列表，按 `Esc` 退出搜索。

### 3.7 快捷键

| 按键 | 行为 |
|---|---|
| `↑` / `↓`、`j` / `k` | 移动当前列表选中项 |
| `Tab` / `Shift+Tab` | 切换焦点区域 |
| `1` | 聚焦项目栏 |
| `2` | 聚焦 session 栏 |
| `3` | 聚焦详情栏 |
| `Enter` | 打开 Agent 选择器或确认当前焦点操作 |
| `/` | 搜索 |
| `Esc` | 关闭弹层、退出搜索 |
| `r` | 重新扫描 |
| `?` | 显示帮助 |
| `q` | 退出 |

首版不绑定 `d` 删除快捷键，避免用户误以为删除功能已经可用。

### 3.8 响应式布局

终端宽度变化时优先保证列表可读性：

- 宽度大于等于 120 列：显示完整三栏。
- 宽度 90 至 119 列：保留项目栏和 session 栏，详情改为弹层展示。
- 宽度小于 90 列：只显示当前焦点栏，按 `Tab` 切换其他栏。
- 高度不足时，列表区域滚动，顶部 Agent 选择器和底部状态栏保持可见。

## 4. 技术架构

### 4.1 分层结构

```text
OpenTUI Components
        │
App Store / Derived State
        │
Application Use Cases
        │
Application Ports
        │
Pi / Codex / Future Agent Adapters
        │
Agent-specific storage
```

`domain/` 只定义统一的 Agent 无关模型。`application/` 定义 scanner、parser、deleter 等统一接口，并编排扫描、详情和删除用例。`adapters/` 由每个 Agent 自己实现格式和存储适配。UI 和 Store 不直接访问文件系统，也不依赖 Pi 或 Codex 的原始类型。

### 4.2 Agent 能力接口

```ts
interface SessionScanner {
  rootPath: string
  detect(): Promise<AgentDetection>
  scan(options?: ScanOptions): Promise<ScanResult>
}

interface SessionParser {
  parseSummary(source: SessionSource, signal?: AbortSignal): Promise<ParsedSession>
  loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail>
}

interface SessionDeleter {
  deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult>
}

interface AgentAdapter {
  id: AgentId
  info: AgentInfo
  scanner: SessionScanner
  parser: SessionParser
  deleter?: SessionDeleter
}
```

首版实现 `PiAdapter` 和 `CodexAdapter` 的 scanner、parser。删除接口已预留但尚未启用；未来 Agent 只需实现这些统一 ports，不修改 TUI 展示模型和业务用例。

### 4.3 统一展示模型和状态

`SessionSummary` 不暴露 `filePath`、`recordCount` 等特定存储格式字段，而是使用 `agentId`、`SessionRef`、通用摘要字段和 Agent 提供的详情字段。不同 Agent 的 session ID 使用 Agent 作用域，避免跨 Agent 冲突。

Store 负责：

- 当前 Agent、项目、session 和详情。
- 搜索、排序、焦点和扫描状态。
- 当前选中 session 以及未来的多选集合。
- 扫描、详情、删除用例的 loading、取消、错误和竞态保护。

多选是应用层状态，不属于任何 Agent。批量删除用例按 `agentId` 分组，调用对应 Agent 的 deleter，汇总逐项结果并在成功后重新扫描。

## 5. Pi 适配器设计

### 5.1 默认目录

Pi 默认 session 根目录：

```text
~/.pi/agent/sessions
```

支持以下覆盖方式，优先级从高到低：

1. CLI 参数：`--pi-sessions-dir <path>`。
2. 环境变量：`AGC_PI_SESSIONS_DIR`。
3. 默认路径：`~/.pi/agent/sessions`。

首版只读取本地文件，不调用 Pi 内部 API。

### 5.2 文件发现

扫描规则：

- 递归遍历 session 根目录下的文件。
- 扫描所有 `.jsonl` 文件，不依赖文件名格式。
- 不跟随指向根目录外部的符号链接。
- 读取文件 metadata 获取大小和修改时间。
- 空文件、无法读取文件和非标准文件都要产生可见的扫描问题。
- 扫描过程不能修改访问时间、文件内容或文件权限。

不能只通过项目目录名推断项目路径。Pi 的项目目录名可能是编码后的路径，应优先读取 session 文件中的 header。

### 5.3 Session header

当前 Pi session 文件的第一条记录形态类似：

```json
{
  "type": "session",
  "version": 3,
  "id": "019e6c71-f698-7a06-a404-cca1b7f0b209",
  "timestamp": "2026-05-28T02:37:48.568Z",
  "cwd": "/path/to/project"
}
```

解析器必须：

- 校验第一条记录是否为 session header。
- 读取 `id`、`timestamp`、`cwd` 和 `version`。
- 对未知字段保持兼容，不因新增字段失败。
- 对缺失字段提供 fallback，并生成 warning。
- 不假定未来 Pi 版本始终使用相同的文件名和字段集合。

### 5.4 消息解析

Pi session 使用 JSONL 保存多种记录，可能包含 model change、thinking level change 和 message 等类型。

扫描时只提取展示需要的字段：

- `type`。
- 消息角色。
- 消息时间。
- 文本内容。
- provider/model。

对于 `message.content` 数组，只提取其中的 text 内容。图片、工具结果、思维过程和未知内容不直接展开到列表中。

### 5.5 两阶段扫描

为避免启动时读取大量 session 内容，使用两阶段策略。

#### 第一阶段：发现和摘要扫描

对所有文件执行：

- 文件路径和 metadata 读取。
- 首行 header 解析。
- 项目分组。
- session ID、创建时间、更新时间和大小提取。
- 计算基础记录数量。
- 提取标题所需的最小文本。

#### 第二阶段：详情扫描

用户选中 session 后，再读取该文件生成详情：

- 完整消息数量。
- 第一条和最后一条用户消息。
- provider/model 汇总。
- 解析警告。
- 记录统计。

禁止使用一次性 `readFile` 将整个大 session 加载到内存。应使用流式读取或分段读取。

### 5.6 项目分组

分组 key 使用规范化后的 `cwd`：

1. 读取 header 中的 `cwd`。
2. 使用平台对应的路径规范化规则。
3. 同一路径下的所有 session 归为同一个项目。
4. `cwd` 缺失时使用 session 所在目录作为 fallback。
5. 仍无法确定时归入 `Unknown project`。

项目 ID 不应只使用项目名称，因为不同目录可能存在同名项目。建议使用规范化绝对路径和 Agent ID 生成稳定且有作用域的 ID。

## 5.7 Codex 适配器设计

Codex 默认 session 根目录：

```text
~/.codex/sessions
```

如果设置了 `CODEX_HOME`，则使用 `$CODEX_HOME/sessions`。也支持 CLI 参数 `--codex-sessions-dir` 和环境变量 `AGC_CODEX_SESSIONS_DIR` 覆盖路径。

Codex session 是按日期递归存储的 rollout JSONL 文件。首条 `session_meta` 记录提供 session ID、创建时间和 cwd；`turn_context` 提供模型信息；`event_msg` 和 `response_item` 提供消息摘要。扫描只读取 JSONL，不修改 Codex 的 SQLite 索引或其他本地状态。

## 6. 目录结构

首版项目建议采用以下结构：

```text
agc/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── README.md
├── docs/
│   └── AGC-首版开发文档.md
└── src/
    ├── main.tsx
    ├── app.tsx
    ├── domain/
    │   ├── agent.ts
    │   ├── project.ts
    │   ├── session.ts
    │   ├── scan.ts
    │   ├── selection.ts
    │   └── operation.ts
    ├── application/
    │   ├── ports.ts
    │   └── use-cases/
    │       ├── scan-sessions.ts
    │       ├── load-session-detail.ts
    │       ├── delete-sessions.ts
    │       └── index.ts
    ├── adapters/
    │   ├── registry.ts
    │   ├── pi/
    │   │   ├── adapter.ts
    │   │   ├── scanner.ts
    │   │   ├── parser.ts
    │   │   ├── text-summary.ts
    │   │   └── types.ts
    │   └── codex/
    │       ├── adapter.ts
    │       ├── scanner.ts
    │       ├── parser.ts
    │       └── types.ts
    ├── services/
    │   ├── discover-jsonl.ts
    │   └── scan-service.ts
    ├── store/
    │   └── app-store.ts
    ├── components/
    │   ├── app-shell.tsx
    │   ├── agent-selector.tsx
    │   ├── project-list.tsx
    │   ├── session-list.tsx
    │   ├── session-detail.tsx
    │   ├── search-input.tsx
    │   ├── help-dialog.tsx
    │   ├── empty-state.tsx
    │   └── status-bar.tsx
    ├── theme/
    │   └── tokens.ts
    └── utils/
        ├── paths.ts
        ├── format.ts
        └── truncate.ts
```

## 7. OpenTUI 实现要求

### 7.1 渲染

- 使用 `@opentui/core` 创建 renderer。
- 使用 `@opentui/solid` 渲染 SolidJS 组件。
- 使用 Box、Text、ScrollBox、Input 等终端原语构建界面。
- 不手写 ANSI 光标定位和颜色控制逻辑。
- 终端尺寸变化时重新计算三栏宽度。

### 7.2 交互

- 所有 UI 状态通过 SolidJS signals 或统一 store 管理。
- 键盘事件集中处理，列表组件只处理自己的导航事件。
- 搜索、Agent 选择器和帮助页面使用弹层，不离开主页面。
- 项目变更后自动将 session 选择定位到该项目的第一项。
- session 不存在或扫描失败时，详情栏显示明确的空状态，不保留旧详情。

### 7.3 视觉规范

- 主背景：深色 graphite。
- 面板：比背景略亮的深灰色。
- 主强调色：低饱和紫色。
- 辅助强调色：青色，用于扫描状态和可交互提示。
- 错误色：红色，仅用于错误和警告。
- 当前选中项使用背景色加左侧强调线。
- 普通列表项避免每行完整边框，减少视觉噪音。
- 重要信息使用字号、粗细和间距区分，不依赖颜色 alone。
- 所有文字都必须支持截断，不能让长路径破坏布局。
- Emoji 和特殊图标必须准备 ASCII fallback。

## 8. 扫描流程

```text
启动
  ↓
初始化 OpenTUI renderer
  ↓
注册 Agent adapters
  ↓
加载 Agent selector
  ↓
激活 Pi adapter
  ↓
检查 session 根目录
  ↓
扫描 JSONL 文件
  ↓
解析项目和 session 摘要
  ↓
写入内存 store
  ↓
默认选择最近更新的项目
  ↓
默认选择该项目最近更新的 session
  ↓
显示主界面
```

重新扫描时：

1. 保留当前 Agent。
2. 显示扫描中状态。
3. 取消或忽略旧扫描结果，避免旧任务覆盖新结果。
4. 扫描完成后尝试恢复原项目和 session 选择。
5. 如果原对象已不存在，则选择最近更新的可用对象。

## 9. 空状态和错误状态

### 9.1 找不到目录

```text
No Pi sessions found

AGC looked in:
~/.pi/agent/sessions

Create a Pi session or use --pi-sessions-dir to choose another directory.
```

### 9.2 没有项目

```text
No projects found

The Pi session directory is empty.
```

### 9.3 项目没有 session

```text
No sessions in this project

Try another project or press r to rescan.
```

### 9.4 解析失败

解析失败的文件不应让整个扫描失败。应：

- 保留该文件的基本信息（路径、大小、修改时间）。
- 显示 warning 标记。
- 详情栏显示失败原因。
- 在状态栏统计失败文件数量。

## 10. 测试计划

### 10.1 Pi 和 Codex parser 单元测试

- 正常 session header。
- 缺失 cwd。
- 缺失 id。
- 不同 version。
- 空文件。
- 非 JSON 首行。
- 未知 record type。
- 多条 user/assistant message。
- 多段 text content。
- 超长文本截断。
- 包含中文、emoji 和 ANSI 字符的文本。

### 10.2 Scanner 集成测试

使用临时目录构造多个项目和 session：

- 多个项目正确分组。
- 同一项目多个 session 正确排序。
- 文件大小统计正确。
- 修改时间排序正确。
- 文件不存在或无权限时返回可展示的 issue。
- 扫描不会修改文件内容、权限和时间信息。
- 大文件不会被一次性加载到内存。

### 10.3 Store 和交互测试

- 默认选择最近项目。
- 切换项目后 session 列表更新。
- 切换 session 后详情更新。
- 搜索同时过滤项目和 session。
- 搜索结果为空时显示空状态。
- 重新扫描后恢复已有选择。
- 选中的 session 被外部删除后清空旧详情。
- 选择不支持的 Agent 时保持当前 Agent 数据不变。

### 10.4 TUI 验收测试

- 终端宽度变化不会出现文字溢出。
- 长路径、长标题和长消息都能正确截断。
- 键盘焦点明确可见。
- 三栏滚动互不影响。
- 扫描期间界面仍可退出。
- 大量 session 下界面不会明显卡顿。

## 11. 首版验收标准

1. 运行 `agc` 后可以进入 TUI。
2. 顶部存在 Agent 选择器，Pi 和 Codex 可用，其他 Agent 明确显示为未支持。
3. AGC 可以从默认目录读取 Pi 和 Codex session。
4. 左栏展示所有已识别项目及 session 数量。
5. 选择项目后，中栏只展示该项目的 session。
6. 选择 session 后，右栏展示其详细信息。
7. 能处理空目录、损坏文件和缺失字段。
8. 支持 `/` 搜索和 `r` 重新扫描。
9. 首版不存在删除入口，也不会修改任何 session 文件。
10. 在常见终端尺寸下布局可读、焦点明确、列表可滚动。

## 12. 开发里程碑

### M1：项目初始化与 OpenTUI 验证

- 初始化 Bun + TypeScript 项目。
- 接入 OpenTUI 和 SolidJS。
- 完成 renderer 启动、退出和尺寸监听。
- 做出静态三栏布局。

### M2：Pi 和 Codex 文件发现

- 实现默认路径和路径覆盖参数。
- 实现 JSONL 文件发现。
- 实现 Pi header 和 Codex `session_meta` 解析。
- 实现项目分组。
- 完成基础扫描测试。

### M3：主界面数据绑定

- 接入 Agent selector。
- 接入项目列表。
- 接入 session 列表。
- 接入详情面板。
- 实现扫描状态、空状态和错误状态。

### M4：交互完善

- 实现焦点切换。
- 实现搜索。
- 实现刷新。
- 实现排序。
- 实现帮助弹层。
- 完成响应式布局和终端兼容性处理。

### M5：首版验收

- 完成 parser、scanner、store 和 TUI 测试。
- 使用真实 Pi 和 Codex session 目录进行手动验收。
- 确认所有操作均为只读。
- 发布 v0.1 展示版。

## 13. 后续版本预留

删除能力不进入 v0.1，但数据模型需要保留以下扩展空间：

- Session 多选状态。
- 删除候选集合。
- 删除前的二次确认。
- 文件变化检测。
- 永久删除结果报告。
- 删除失败重试和部分成功状态。
- 未来可能的回收站策略。

后续新增 Agent 时，应该新增对应目录：

```text
src/adapters/claude-code/
src/adapters/codex/
src/adapters/antigravity/
```

三栏 UI、store 和通用 session 数据模型不应因为新增 Agent 而重写。

## 14. 待确认事项

以下事项不阻塞 v0.1 的界面和 Pi 适配器开发，但在实现前需要最终确定：

1. 首版是否只支持 macOS/Linux，还是同时支持 Windows。
2. CLI 命令是否正式使用 `agc`。
3. session 标题是否允许直接使用第一条用户消息摘要。
4. 详情面板是否需要支持复制 session 路径。
5. 默认是否显示解析后的完整消息数量，还是只显示可快速获取的记录数量。
