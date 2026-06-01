"""
services/data_service.py - 数据管理服务
=========================================
【层】业务逻辑层（Service）
【说明】负责文件上传后的解析、保存和预览信息提取。
        调用数据访问层保存文件并返回唯一引用和预览信息，不暴露文件路径。
【负责人】数据管理模块开发人员
"""

from typing import Any

import pandas as pd

from repositories.base import DataRepository
from value_objects import DatasetRef


class DataService:
    """
    数据管理服务。

    处理文件上传：接收 Flask 上传文件对象，调用 Repository 保存并返回预览信息。
    """

    def __init__(self, repo: DataRepository):
        """
        通过构造函数注入 DataRepository 抽象。

        Args:
            repo: 数据仓库实例（MVP 阶段为 FileRepository）。
        """
        self.repo = repo

    def upload(self, file_storage: Any) -> tuple[DatasetRef, dict]:
        """
        处理上传文件，返回数据集引用和预览信息。

        Args:
            file_storage: Flask 上传文件对象 (werkzeug.datastructures.FileStorage)。

        Returns:
            (DatasetRef, preview_dict) 元组。
            preview_dict 包含:
                - "columns": 列名列表
                - "preview": 前 5 行数据（列表的列表）
                - "shape": [行数, 列数]
                - "dtypes": 各列数据类型字典（可选，便于前端展示）

        【待实现】
        - 根据文件扩展名选择合适的读取方式（pd.read_csv / pd.read_excel）
        - 处理文件编码问题（如 CSV 的 UTF-8/GBK 自动检测）
        - 大文件的分块处理或超时保护（可选）
        - 完善异常处理（文件格式不支持、解析失败等）
        """
        # ================================================================
        # 1. 根据文件后缀判断解析方式
        # 【负责人：】数据管理模块开发人员
        # ================================================================
        filename = file_storage.filename or "unnamed"
        # ---------- 待实现：确定文件类型并解析为 DataFrame ----------
        df: pd.DataFrame = self._parse_file(file_storage, filename)

        # ================================================================
        # 2. 通过数据访问层保存数据
        # 【说明】repo.save_data 由通用组件提供，此处直接调用
        # ================================================================
        dataset_ref = self.repo.save_data(df)

        # ================================================================
        # 3. 构造预览信息
        # 【负责人：】数据管理模块开发人员
        # ================================================================
        preview = {
            "columns": df.columns.tolist(),
            "preview": df.head(5).values.tolist(),
            "shape": list(df.shape),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        }

        return dataset_ref, preview

    def _parse_file(self, file_storage: Any, filename: str) -> pd.DataFrame:
        """
        根据文件扩展名解析上传文件为 DataFrame。

        Args:
            file_storage: Flask 上传文件对象。
            filename: 原始文件名（用于判断扩展名）。

        Returns:
            解析后的 pandas DataFrame。

        Raises:
            ValueError: 文件类型不支持或解析失败。

        【待实现】
        - 扩展名检测（.csv / .xlsx / .xls）
        - CSV 编码自动检测（chardet 或类似方法）
        - pd.read_csv / pd.read_excel 的参数调优
        """
        # ---------- 【待实现：数据管理模块】替换为实际解析逻辑 ----------
        raise NotImplementedError("数据管理模块开发人员需实现 _parse_file 方法")
