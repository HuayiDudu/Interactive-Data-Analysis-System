# JavaScript 文件

**层**：表示层（Web 界面）

## 文件说明

| 文件 | 负责人 | 说明 |
|------|--------|------|
| `upload.js` | 数据管理模块 | 文件上传、预览渲染、导出 |
| `clean.js` | 数据清洗模块 | 清洗参数配置、执行清洗 |
| `plot.js` | 可视化模块 | 图表参数配置、生成图表 |
| `analyze.js` | 分析功能模块 | 算法参数配置、执行分析 |
| `app.js` | Web 界面模块 | 主控逻辑、集成各模块、状态管理 |

## 加载顺序（在 index.html 中）

```
upload.js → clean.js → plot.js → analyze.js → app.js
```

每个模块 JS 先加载暴露函数，最后 `app.js` 统一调用集成。

## 编写规范

- 函数命名：`camelCase`（如 `handleUpload`）
- 必须使用分号
- async/await 优先于 Promise.then()
