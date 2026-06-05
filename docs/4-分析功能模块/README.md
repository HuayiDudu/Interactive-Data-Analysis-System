# 分析功能模块

**所属**：分析功能模块开发人员
**负责内容**：K-Means/DBSCAN 聚类、线性/多项式回归、聚类对比、回归对比
**状态**：✅ 已实现（后端 6 种算法 + 统一/独立双路由 + 前端格式化渲染）

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：流程、实现步骤、接口规范、验收标准 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/analyze_service.py` | **已实现** | 分析核心逻辑：6 种算法 + 统一分发入口 + 公有方法 |
| `routes/analyze.py` | **已实现** | POST /analyze 分发路由 + 6 条独立路由 + 异常处理装饰器 |
| `static/js/analyze.js` | **已实现** | 前端分析参数配置、格式化渲染、独立 runner 函数、AnalyzeModule 导出 |

## 实现的算法

| 算法 | 路由 | 说明 |
|------|------|------|
| K-Means 聚类 | `POST /analyze/kmeans` | 支持列选择，K 值 2-10 可调，含轮廓系数/DB 指数 |
| DBSCAN 密度聚类 | `POST /analyze/dbscan` | 自动标准化，eps/min_samples 可调 |
| 线性回归 | `POST /analyze/regression` | 支持多特征列，返回 R²/MAE/RMSE |
| 多项式回归 | `POST /analyze/poly_regression` | 单特征，阶数 2-5 可调 |
| 聚类对比 | `POST /analyze/compare/clustering` | K-Means vs DBSCAN 对比表 |
| 回归对比 | `POST /analyze/compare/regression` | 线性/Ridge/Lasso/多项式对比，自动标注最优 |

## 快速链接

- [开发文档](开发文档.md)
- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
