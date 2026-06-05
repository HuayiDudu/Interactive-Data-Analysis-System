"""
repositories/file_repo.py - 文件仓库（MVP 实现）
===================================================
【层】数据访问层（Repository）
【说明】MVP 阶段的数据仓库实现，基于临时 CSV 文件存储。
        使用应用级字典维护 DatasetRef 到文件路径的映射。
        所有路径对外不可见，上层仅通过 DatasetRef 进行数据访问。
【负责人】数据管理模块开发人员
"""

import os
import uuid

import pandas as pd

from config import UPLOAD_FOLDER
from repositories.base import DataRepository
from value_objects import DatasetRef


class FileRepository(DataRepository):
    """
    MVP 文件数据仓库。

    内部使用字典维护引用到文件路径的映射，数据集以 CSV 文件形式存储在 UPLOAD_FOLDER 中。
    映射字典存储在内存中，重启后清空，符合 MVP 临时性特征。

    【待实现】
    - 考虑线程安全，是否需要对 _ref_map 加锁
    - 考虑定期清理过期文件的机制（可选的）
    - 异常处理完善（磁盘空间不足、文件写入冲突等）
    """

    def __init__(self):
        """初始化仓库，确保上传目录存在。"""
        # ------------- 待实现：确保 UPLOAD_FOLDER 存在 -------------
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # ref_id -> 绝对文件路径 的映射字典
        self._ref_map: dict[str, str] = {}

    def save_data(self, df: pd.DataFrame, context: dict | None = None) -> DatasetRef:
        """
        保存 DataFrame 为 CSV 临时文件，返回新生成的 DatasetRef。

        Args:
            df: 要保存的 DataFrame。
            context: 可选上下文（MVP 阶段忽略）。

        Returns:
            新生成的 DatasetRef。
        """
        # ================================================================
        # 【待实现】
        # 1. 使用 uuid.uuid4().hex 生成唯一 ID
        # 2. 拼接文件路径: os.path.join(UPLOAD_FOLDER, f"{ref_id}.csv")
        # 3. 调用 df.to_csv(filepath, index=False) 写入
        # 4. 在 self._ref_map 中记录映射关系
        # 5. 返回 DatasetRef(ref_id)
        # ================================================================

        ref_id = uuid.uuid4().hex
        filepath = os.path.join(UPLOAD_FOLDER, f"{ref_id}.csv")

        # 【待实现】处理写入异常（磁盘空间不足、权限错误等）
        df.to_csv(filepath, index=False)

        self._ref_map[ref_id] = filepath
        return DatasetRef(ref_id)

    def load_data(self, ref: DatasetRef) -> pd.DataFrame:
        """
        根据引用加载 DataFrame。

        Args:
            ref: 数据集引用。

        Returns:
            对应的 pandas DataFrame。

        Raises:
            ValueError: 数据集不存在或已被清理。
        """
        # ================================================================
        # 【待实现】
        # 1. 从 self._ref_map 中根据 ref.id 获取文件路径
        # 2. 若文件路径不存在或文件已被删除，抛出 ValueError
        # 3. 调用 pd.read_csv(filepath) 读取数据
        # ================================================================

        filepath = self._ref_map.get(ref.id)
        if not filepath or not os.path.exists(filepath):
            raise ValueError(f"数据集不存在或已被清理: {ref.id}")

        # 【待实现】可根据需要指定数据类型、编码等参数
        return pd.read_csv(filepath)

    # ================================================================
    # 用户管理（MVP 阶段暂不支持，抛出 NotImplementedError）
    # ================================================================

    def create_user(self, username: str, password_hash: str) -> int:
        raise NotImplementedError("FileRepository 不支持用户管理")

    def get_user_by_username(self, username: str) -> dict | None:
        raise NotImplementedError("FileRepository 不支持用户管理")

    def get_user_by_id(self, user_id: int) -> dict | None:
        raise NotImplementedError("FileRepository 不支持用户管理")

    def delete_data(self, ref: DatasetRef) -> None:
        """
        删除引用对应的临时文件及映射。

        Args:
            ref: 要删除的数据集引用。
        """
        # ================================================================
        # 【待实现】
        # 1. 从 self._ref_map 中弹出 ref.id 对应的文件路径
        # 2. 若文件存在，调用 os.remove 删除
        # 3. 处理文件已被其他进程占用等异常情况
        # ================================================================

        filepath = self._ref_map.pop(ref.id, None)
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
