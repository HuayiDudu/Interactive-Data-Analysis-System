# 数据访问层（Repository）
# 【负责人】项目负责人（抽象接口）/ 数据管理模块（具体实现）

**层**：数据访问层
**负责人**：项目负责人（抽象接口）/ 数据管理模块（具体实现）

## 本目录文件

| 文件 | 说明 |
|------|------|
| `__init__.py` | 包导出，暴露 DataRepository, FileRepository |
| `base.py` | `DataRepository` 抽象基类（save/load/delete） |
| `file_repo.py` | `FileRepository` MVP 实现（CSV 临时文件） |

## 职责

- 封装数据存储细节，向上层提供统一抽象接口
- MVP 阶段：基于临时 CSV 文件，应用级字典维护引用映射
- 扩展阶段：可增加 `SQLiteRepository`（Parquet + SQLite BLOB）

## 层间依赖规则

```
Service → Repository 抽象 → FileRepository → 文件系统
           只依赖抽象       （具体实现）       （存储层）
```

- 禁止调用任何业务规则或算法
- 禁止向上层暴露文件路径和数据库连接对象
