# 上传文件临时存储

**说明**：运行时自动生成的 CSV 临时文件存放目录，由 `FileRepository` 管理。

- 文件命名：`{UUID}.csv`
- 应用重启后映射丢失，符合 MVP 临时性特征
- 此目录下的 `*.csv` 已被 `.gitignore` 排除
