# Web 界面模块

**所属**：Web 界面模块开发人员
**负责内容**：登录页 + 主界面 HTML/CSS、前端主控逻辑（app.js）、集成各模块 JS
**状态**：✅ 已完成

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：流程、实现步骤、接口规范、验收标准 |
| `可视化自定义参数接入说明.md` | 可视化自定义参数的前端接入指导 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `templates/login.html` | **实现** | 登录/注册页（星空动画 + 认证表单） |
| `templates/index.html` | **实现** | 主界面（侧边栏 + 五个功能面板） |
| `static/css/style.css` | **实现** | Cyber-luxury 暗色主题 |
| `static/js/app.js` | **实现** | 主控逻辑（导航、toast、截图、登出） |

## 对接的各模块 JS

| JS 文件 | 调用函数 | 所属模块 | 状态 |
|---------|---------|---------|:----:|
| `upload.js` | `handleUpload()`, `renderPreview()`, `handleExport()` | 数据管理模块 | ✅ |
| `clean.js` | `populateCleanOptions()`, `collectCleanParams()`, `handleClean()` | 数据清洗模块 | ✅ |
| `plot.js` | `populatePlotColumns()`, `handlePlot()` | 可视化模块 | ✅ |
| `analyze.js` | `handleAnalyze()`, `populateAlgorithmParams()` | 分析功能模块 | ✅ 前端 |

## 技术依赖

- Bootstrap 5.3 + Plotly.js 2.32.0 + GSAP 3.12（CDN 引入）
- Flask session 维护登录态，未登录跳转回 `/`

## 快速链接

- [开发文档](开发文档.md)
- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
