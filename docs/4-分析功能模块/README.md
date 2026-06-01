# 分析功能模块

**所属**：分析功能模块开发人员
**负责内容**：K-Means 聚类、线性回归（可选）

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：流程、实现步骤、接口规范、验收标准 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/analyze_service.py` | **实现** | 分析核心逻辑：K-Means / 线性回归 |
| `routes/analyze.py` | **实现** | POST /analyze |
| `static/js/analyze.js` | **实现** | 前端分析参数配置和结果展示 |

## 开发流程

1. 从 `dev` 分支创建 `feat/分析功能-xxx` 分支
2. 实现 `analyze_service.py` → `analyze.py` → `analyze.js`
3. 注意：scikit-learn 返回的 numpy 类型必须转为 Python 原生类型
4. 发起 PR → dev，通知项目负责人 Review

## 快速链接

- [开发文档](开发文档.md)
- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
