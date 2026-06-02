# Git Hooks — 提交规范检查
# 【负责人】项目负责人

**负责人**：项目负责人

## 本目录文件

| 文件 | 作用 |
|------|------|
| `commit-msg` | 校验 commit message 格式 `<type>: <描述>` |
| `pre-commit` | 检查遗留的 NotImplementedError 和 print 调试语句 |

## 启用方式

```bash
git config core.hooksPath githooks/
```

所有开发人员 clone 项目后必须运行此命令。
