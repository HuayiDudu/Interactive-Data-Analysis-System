# 项目负责人

**角色**：项目负责人（Project Lead）
**负责人**：项目负责人
**负责内容**：架构设计、框架搭建、通用组件维护、Git 管理、Code Review、集成测试、进度跟踪

## 本目录文件

| 文件 | 说明 |
|------|------|
| `开发文档.md` | 完整工作手册：职责、流程、CR 清单、集成测试流程、排查指南 |
| `README.md` | 本文件 |

## 涉及代码文件

| 文件 | 说明 |
|------|------|
| `config.py` | 全局配置 |
| `value_objects.py` | DatasetRef 值对象 |
| `repositories/base.py` | DataRepository 抽象接口 |
| `repositories/file_repo.py` | FileRepository 实现 |
| `repositories/__init__.py` | 包导出 |
| `services/__init__.py` | Service 导出 |
| `routes/__init__.py` | 蓝图注册 |
| `app.py` | 应用工厂 + 依赖注入 |
| `requirements.txt` | 依赖管理 |
| `.gitignore` | Git 忽略规则 |
| `githooks/` | Git 提交规范检查 |

## 快速链接

- [通用规范](../项目开发规范(必看).md)
- [集成指南](../项目集成指南(必看).md)
- [进度跟踪](../进度跟踪.md)
