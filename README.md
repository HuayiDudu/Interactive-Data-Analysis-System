# Interactive-Data-Analysis-System

WUT Python 课程实验 —— 交互式数据分析系统

---

## 项目简介

基于 Web 的数据分析工具，支持上传 CSV/Excel 文件，进行数据清洗、可视化、机器学习分析（K-Means 聚类 / 线性回归），并导出结果。采用五层分层架构，MVP 阶段使用临时文件存储，扩展阶段可增加 SQLite、多用户登录等。

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端框架 | Flask |
| 数据处理 | pandas, numpy |
| 文件解析 | openpyxl (xlsx) |
| 可视化 | Matplotlib 或 Plotly（由可视化模块决定） |
| 机器学习 | scikit-learn |
| 前端 | Bootstrap 5 + 原生 JavaScript |
| 数据存储（MVP） | CSV 临时文件 |
| 数据存储（扩展） | SQLite + Parquet |

## 项目架构（五层）

```
表示层（Web 界面）     → HTML + Bootstrap + JavaScript
    ↓ HTTP REST API
控制层（Flask 路由）   → 接收请求，调用 Service，统一 JSON 返回
    ↓ Python 函数调用
业务逻辑层（Service）   → 清洗、可视化、分析等核心算法
    ↓ Repository 抽象接口
数据访问层（Repository）→ MVP: 临时文件 / 扩展: SQLite
    ↓ 文件 I/O 或 DB API
数据存储层（物理存储）   → MVP: 临时 CSV 文件 / 扩展: SQLite 数据库
```

详细架构见 `docs/交互式数据分析系统 - 开发说明文档（不用细看，可了解）.md`。

## 团队分工

| 角色 | 负责内容 | 涉及文件 |
|------|---------|---------|
| **项目负责人（通用组件/集成）** | 架构抽象、Repository 接口、Config、App 工厂、蓝图注册 | `repositories/base.py`, `repositories/__init__.py`, `config.py`, `value_objects.py`, `app.py`, `routes/__init__.py`, `services/__init__.py` |
| **数据管理模块** | 文件上传解析、数据预览、导出、文件数据仓库 | `repositories/file_repo.py`, `services/data_service.py`, `routes/upload.py`, `routes/export.py`, `static/js/upload.js` |
| **数据清洗模块** | 缺失值处理、IQR 异常检测 | `services/clean_service.py`, `routes/clean.py`, `static/js/clean.js` |
| **可视化模块** | 散点图/折线图/柱状图生成 | `services/visualize_service.py`, `routes/plot.py`, `static/js/plot.js` |
| **分析功能模块** | K-Means 聚类、线性回归 | `services/analyze_service.py`, `routes/analyze.py`, `static/js/analyze.js` |
| **Web 界面模块** | HTML/CSS/JS 主控、流程集成 | `templates/index.html`, `static/css/style.css`, `static/js/app.js` |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
python app.py
```

访问 http://localhost:5000

### 3. 开发模式

```bash
python app.py  # 默认开启 debug 模式，代码修改后自动重载
```

### 4. 启用 Git 提交规范检查（重要，每人必做）

```bash
git config core.hooksPath githooks/
```

设置后 commit message 必须符合 `<type>: <描述>` 格式，否则会被拦截。

---

## 文件结构

```
├── app.py                 # 应用入口
├── config.py              # 全局配置
├── value_objects.py       # 值对象（DatasetRef）
├── requirements.txt       # 依赖清单
├── uploads/               # 上传文件临时存储
├── repositories/          # 数据访问层
├── services/              # 业务逻辑层
├── routes/                # 控制层（Flask 路由）
├── templates/             # 前端页面
├── static/                # 静态资源
│   ├── css/
│   ├── js/                # upload/clean/plot/analyze + app.js
└── docs/                  # 开发文档
    ├── 0-项目负责人/        # 架构 + 通用组件 + 集成
    ├── 1-数据管理模块/
    ├── 2-数据清洗模块/
    ├── 3-可视化模块/
    ├── 4-分析功能模块/
    └── 5-Web界面模块/
```

## 开发文档

### 通用说明
- `docs/项目开发规范(必看).md` — 编码规范、协作流程
- `docs/项目集成指南(必看).md` — 各模块集成步骤
- `docs/进度跟踪.md` — 项目进度看板

### 各角色文档（每人一份，放在对应文件夹中）
- `docs/0-项目负责人/开发文档.md`
- `docs/1-数据管理模块/开发文档.md`
- `docs/2-数据清洗模块/开发文档.md`
- `docs/3-可视化模块/开发文档.md`
- `docs/4-分析功能模块/开发文档.md`
- `docs/5-Web界面模块/开发文档.md`

## 扩展规划

- SQLite 数据库集成（Parquet 格式存储）
- 多用户登录与权限管理
- 清洗规则模板保存与应用
- 自定义图表样式（标题、颜色、坐标轴）
- 多算法对比与评估指标
