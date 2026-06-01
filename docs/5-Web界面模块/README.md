# Web 界面模块

**所属**：Web 界面模块开发人员
**负责内容**：HTML 页面结构、CSS 样式、前端主控逻辑（app.js）、集成各模块 JS

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：流程、实现步骤、接口规范、验收标准 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `templates/index.html` | **实现** | 主页面（完整 6 步流程） |
| `static/css/style.css` | **实现** | 全局样式 |
| `static/js/app.js` | **实现** | 主控逻辑，调用各模块 JS |

## 对接的各模块 JS

| JS 文件 | 调用函数 | 所属模块 |
|---------|---------|---------|
| `upload.js` | `handleUpload()`, `renderPreview()`, `handleExport()` | 数据管理模块 |
| `clean.js` | `populateCleanOptions()`, `collectCleanParams()`, `handleClean()` | 数据清洗模块 |
| `plot.js` | `populatePlotColumns()`, `handlePlot()` | 可视化模块 |
| `analyze.js` | `handleAnalyze()`, `populateAlgorithmParams()` | 分析功能模块 |

## 开发流程

1. 从 `dev` 分支创建 `feat/Web界面-xxx` 分支
2. 完善 `index.html` 布局 → `style.css` 样式 → `app.js` 流程控制
3. 与其他模块协商 JS 函数接口，各模块实现后联调
4. 发起 PR → dev，通知项目负责人 Review

## 快速链接

- [开发文档](开发文档.md)
- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
