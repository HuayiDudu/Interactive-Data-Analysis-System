# 控制层（Flask 路由）
# 【负责人】各模块开发人员（按文件归属）

**层**：控制层
**负责人**：各模块开发人员（按文件归属）

## 本目录文件

| 文件 | 路由 | 负责人 |
|------|------|--------|
| `__init__.py` | 蓝图注册函数 | 项目负责人 |
| `upload.py` | `POST /upload` | 数据管理模块 |
| `clean.py` | `POST /clean` | 数据清洗模块 |
| `plot.py` | `POST /plot` | 可视化模块 |
| `analyze.py` | `POST /analyze` | 分析功能模块 |
| `export.py` | `GET /export` | 数据管理模块 |

## 职责

- 接收 HTTP 请求，解析参数
- 调用 Service 层处理业务逻辑
- 统一 JSON 响应格式

## 响应格式

```json
// 成功
{ "status": "success", "data": { ... } }
// 失败
{ "status": "error", "message": "具体错误原因" }
```
