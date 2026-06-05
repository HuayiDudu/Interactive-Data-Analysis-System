"""
repositories/base.py - 数据仓库抽象基类
=========================================
【层】数据访问层（Repository）
【说明】DataRepository 抽象基类，定义统一的数据访问接口。
        所有 Service 必须依赖此抽象，而非具体实现（依赖倒置原则）。
【负责人】项目负责人（通用组件）
"""

from abc import ABC, abstractmethod

import pandas as pd

from value_objects import DatasetRef


class DataRepository(ABC):
    """
    数据访问层统一接口。

    所有 Service 通过此接口进行数据读写，不依赖具体存储实现。
    MVP 阶段使用 FileRepository（CSV 临时文件），
    扩展阶段可使用 SQLiteRepository（Parquet + SQLite BLOB）。
    """

    @abstractmethod
    def save_data(self, df: pd.DataFrame, context: dict | None = None) -> DatasetRef:
        """
        保存 DataFrame，返回唯一引用。

        Args:
            df: 要保存的 pandas DataFrame。
            context: 可选上下文信息（如 user_id, name 等），MVP 阶段可忽略。

        Returns:
            新生成的 DatasetRef，用于后续操作。
        """
        ...

    @abstractmethod
    def load_data(self, ref: DatasetRef) -> pd.DataFrame:
        """
        根据引用加载 DataFrame。

        Args:
            ref: 数据集引用。

        Returns:
            对应的 pandas DataFrame。

        Raises:
            ValueError: 当 ref 无效或数据集已被清理时抛出。
        """
        ...

    @abstractmethod
    def delete_data(self, ref: DatasetRef) -> None:
        """
        删除引用对应的数据集，用于清理或回滚。

        Args:
            ref: 要删除的数据集引用。
        """
        ...

    # ================================================================
    # 用户管理接口
    # ================================================================

    @abstractmethod
    def create_user(self, username: str, password_hash: str) -> int:
        """
        创建新用户。

        Args:
            username: 用户名（唯一）。
            password_hash: werkzeug 密码哈希值。

        Returns:
            新用户的 id。

        Raises:
            ValueError: 用户名已存在。
        """
        ...

    @abstractmethod
    def get_user_by_username(self, username: str) -> dict | None:
        """
        根据用户名查询用户。

        Returns:
            用户字典 {id, username, password, created_at} 或 None。
        """
        ...

    @abstractmethod
    def get_user_by_id(self, user_id: int) -> dict | None:
        """
        根据 ID 查询用户。

        Returns:
            用户字典 {id, username, password, created_at} 或 None。
        """
        ...

    # ================================================================
    # 扩展接口（MVP 可选实现，默认抛出 NotImplementedError）
    # ================================================================

    def list_datasets(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 10,
        search: str = "",
        order_by: str = "created_at",
        order_dir: str = "desc",
    ) -> dict:
        """
        【扩展接口】分页列出用户的数据集列表。

        Args:
            user_id: 用户 ID。
            page: 页码，从 1 开始，默认 1。
            per_page: 每页条数，默认 10，范围 [5, 50]。
            search: 按文件名模糊检索。
            order_by: 排序字段，可选 'created_at'（默认）、'name'。
            order_dir: 排序方向，'asc' 或 'desc'，默认 'desc'。

        Returns:
            {
                "total": int,
                "page": int,
                "per_page": int,
                "items": [{"id": str, "name": str, "created_at": str, ...}]
            }

        Raises:
            NotImplementedError: MVP 阶段未实现此接口。
        """
        raise NotImplementedError(
            "list_datasets is not implemented in MVP version"
        )
