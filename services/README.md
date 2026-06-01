# 业务逻辑层（Service）

**层**：业务逻辑层
**负责人**：各模块开发人员（按文件归属）

## 本目录文件

| 文件 | 类 | 负责人 |
|------|-----|--------|
| `__init__.py` | 包导出 | 项目负责人 |
| `data_service.py` | `DataService` | 数据管理模块 |
| `clean_service.py` | `CleanService` | 数据清洗模块 |
| `visualize_service.py` | `VisualizeService` | 可视化模块 |
| `analyze_service.py` | `AnalyzeService` | 分析功能模块 |

## 职责

- 实现核心业务逻辑：数据管理、清洗、可视化、分析
- 通过构造函数注入 `DataRepository` 抽象
- 通过 `DatasetRef` 获取数据，不依赖文件路径或 Session

## 层间依赖规则

```
Route → Service → Repository 抽象
        (注入 repo)  (只依赖接口)
```

- 禁止操作 Flask request / session 对象
- 禁止直接操作文件系统或数据库
