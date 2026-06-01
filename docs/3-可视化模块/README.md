# 可视化模块

**所属**：可视化模块开发人员
**负责内容**：散点图、折线图、柱状图生成（Matplotlib 或 Plotly）

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：流程、实现步骤、接口规范、验收标准 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/visualize_service.py` | **实现** | 图表生成核心逻辑 |
| `routes/plot.py` | **实现** | POST /plot |
| `static/js/plot.js` | **实现** | 前端图表交互逻辑 |

## 开发流程

1. 从 `dev` 分支创建 `feat/可视化-xxx` 分支
2. 实现 `visualize_service.py` → `plot.py` → `plot.js`
3. 确定使用 Matplotlib 还是 Plotly，通知 Web 界面模块
   - Matplotlib: 返回 base64 PNG，前端用 `<img>` 显示
   - Plotly: 返回 Plotly JSON，前端需引入 Plotly.js

## 快速链接

- [开发文档](开发文档.md)
- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
