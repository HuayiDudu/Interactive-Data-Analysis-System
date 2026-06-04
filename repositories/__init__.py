"""
repositories 包 - 数据访问层
===============================
【层】数据访问层（Repository）
【说明】提供 DataRepository 抽象接口及其实现（MVP: FileRepository, 扩展: SQLiteRepository）。
        所有 Service 必须依赖 DataRepository 抽象，而非具体实现。
【负责人】项目负责人（通用组件）
"""

from .base import DataRepository
from .file_repo import FileRepository
from .sqlite_repo import SQLiteRepository

__all__ = [
    "DataRepository",
    "FileRepository",
    "SQLiteRepository",
]
