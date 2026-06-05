# AGENTS.md — 项目 AI 规范

通用 AI 行为准则（见下文）+ 本项目特定规则。适用于所有 AI 编码工具（Claude Code、Cursor、Trae、Windsurf 等）。

---

## 通用准则

**Think Before Coding. Simplicity First. Surgical Changes. Goal-Driven Execution.**

1. **Think Before Coding** — 不确定就问，有多种方案就说，别藏着掖着
2. **Simplicity First** — 只解决被要求的问题，不加臆测的功能
3. **Surgical Changes** — 只改必须改的，不顺手"优化"无关代码
4. **Goal-Driven Execution** — 先定验收标准，再动手

---

## 项目上下文

**交互式数据分析系统** — WUT Python 课程实验。

Web 版数据分析工具，支持上传 CSV/Excel → 数据清洗 → 可视化（3种图表）→ 机器学习分析（K-Means/线性回归）→ 导出结果。MVP 阶段使用临时文件存储，扩展阶段增加 SQLite 和多用户。

### 五层架构

```
表示层（Web 界面）    → HTML + Bootstrap + JS
    ↓ HTTP REST API
控制层（Flask 路由）  → 接收请求，调用 Service，统一 JSON 返回
    ↓ Python 函数调用
业务逻辑层（Service）  → 清洗、可视化、分析等核心算法
    ↓ Repository 抽象接口
数据访问层（Repository）→ MVP: 临时文件 / 扩展: SQLite
    ↓ 文件 I/O 或 DB API
数据存储层（物理存储）  → MVP: 临时 CSV 文件 / 扩展: SQLite 数据库
```

### 层间依赖规则（必须遵守）

| 层 | 可以调用 | 禁止调用 |
|---|---------|---------|
| 表示层 | 控制层 HTTP API | 后端代码、文件系统、数据库 |
| 控制层 | Service 实例方法 | 文件系统、pandas、Repository |
| 业务层 | Repository 抽象接口 | Flask request/session、文件系统 |
| 数据访问层 | 文件系统、数据库驱动 | 任何业务规则 |

### 响应格式（HTTP API）

```json
// 成功
{ "status": "success", "data": { ... } }
// 失败
{ "status": "error", "message": "具体错误原因" }
```

---

## 代码所有权

每个源文件头部标有 `【负责人】` 标记：

| 负责人 | 文件 |
|--------|------|
| 项目负责人 | `config.py`, `value_objects.py`, `repositories/base.py`, `repositories/__init__.py`, `app.py`, `requirements.txt`, `.gitignore`, `githooks/*` |
| 数据管理模块 | `repositories/file_repo.py`, `services/data_service.py`, `routes/upload.py`, `routes/export.py`, `static/js/upload.js` |
| 数据清洗模块 | `services/clean_service.py`, `routes/clean.py`, `static/js/clean.js` |
| 可视化模块 | `services/visualize_service.py`, `routes/plot.py`, `static/js/plot.js` |
| 分析功能模块 | `services/analyze_service.py`, `routes/analyze.py`, `static/js/analyze.js` |
| Web 界面模块 | `templates/index.html`, `static/css/style.css`, `static/js/app.js` |

非负责人修改他人文件前需先获得对方同意。代码内的 `【待实现：XXX模块】` 标记表示该模块开发人员需完成的待办。

### AI 实现规范（必读）

当你被要求实现某个功能时，必须遵守以下流程：

1. **先确认身份** — 根据上表明确你当前负责的模块和文件范围，绝不越界修改他人文件
2. **严格按文档开发** — 到 `docs/` 对应模块文件夹中读取开发文档，按文档中的接口契约、实现步骤、验收标准执行，不自作主张
3. **文档疑问上报** — 如果发现文档中有矛盾、模糊或明显不合理之处，**不要自行猜测**。向开发者指出具体问题，并建议开发者向项目负责人确认后再继续

---

## 开发文档索引

各角色完整工作手册在 `docs/` 对应文件夹中：

| 文档 | 路径 |
|------|------|
| 项目负责人手册 | `docs/0-项目负责人/开发文档.md` |
| 数据管理模块 | `docs/1-数据管理模块/开发文档.md` |
| 数据清洗模块 | `docs/2-数据清洗模块/开发文档.md` |
| 可视化模块 | `docs/3-可视化模块/开发文档.md` |
| 分析功能模块 | `docs/4-分析功能模块/开发文档.md` |
| Web 界面模块 | `docs/5-Web界面模块/开发文档.md` |
| 通用开发规范 | `docs/项目开发规范(必看).md` |
| 集成指南 | `docs/项目集成指南(必看).md` |
| 进度跟踪 | `docs/进度跟踪.md` |
| 原始架构说明 | `docs/交互式数据分析系统 - 开发说明文档（不用细看，可了解）.md` |

---

## 编码规范

### Python
- 缩进 4 空格，行宽 100
- 类名 `PascalCase`，函数/变量 `snake_case`，常量 `UPPER_SNAKE_CASE`
- 函数参数和返回值必须加类型注解
- Import 顺序：标准库 → 第三方 → 本地模块

### JavaScript
- 缩进 4 空格，函数/变量 `camelCase`，常量 `UPPER_SNAKE_CASE`
- 必须使用分号，async/await 优先于 Promise.then()

### Git Commit
```
<type>: <简短描述>
```
type: feat / fix / docs / refactor / style / test / chore

---

## 快速命令

```bash
# 启动应用
python app.py

# 安装依赖
pip install -r requirements.txt

# 启用 Git hooks（每人必做）
git config core.hooksPath githooks/
```
