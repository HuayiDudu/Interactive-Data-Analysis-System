"""
services/data_service.py - 数据管理服务
=========================================
【层】业务逻辑层（Service）
【说明】负责文件上传后的解析、保存和预览信息提取。
        调用数据访问层保存文件并返回唯一引用和预览信息，不暴露文件路径。
【负责人】数据管理模块开发人员
"""

from io import BytesIO
from typing import Any

import os

import pandas as pd

from config import ALLOWED_EXTENSIONS
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

        # 去重列名（源文件可能有同名列，如两个"年龄"）
        if not df.columns.is_unique:
            seen: dict[str, int] = {}
            deduped: list[str] = []
            for c in df.columns:
                if c in seen:
                    seen[c] += 1
                    deduped.append(f"{c}_{seen[c]}")
                else:
                    seen[c] = 1
                    deduped.append(c)
            df.columns = deduped

        # ================================================================
        # 2. 通过数据访问层保存数据
        # 【说明】repo.save_data 由通用组件提供，此处直接调用
        # ================================================================
        dataset_ref = self.repo.save_data(df)

        # ================================================================
        # 3. 构造预览信息
        # 【负责人：】数据管理模块开发人员
        # ================================================================
        preview_records = df.head(5).to_dict('records')
        preview_data = []
        for record in preview_records:
            row = []
            for col in df.columns:
                value = record[col]
                if pd.isna(value):
                    row.append(None)
                else:
                    row.append(value)
            preview_data.append(row)
        preview = {
            "columns": df.columns.tolist(),
            "preview": preview_data,
            "shape": list(df.shape),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        }

        return dataset_ref, preview

    def export_data(
        self, dataset_ref: DatasetRef, format: str = "csv"
    ) -> tuple[bytes, str, str]:
        """
        导出数据集为文件。

        Args:
            dataset_ref: 数据集引用。
            format: 导出格式，"csv" 或 "xlsx"。

        Returns:
            (file_data, content_type, filename) 元组。

        Raises:
            ValueError: 不支持的导出格式。
        """
        df = self.repo.load_data(dataset_ref)

        if format == "csv":
            data = df.to_csv(index=False).encode("utf-8-sig")
            content_type = "text/csv"
            filename = f"export_{dataset_ref.id[:8]}.csv"
        elif format == "xlsx":
            buf = BytesIO()
            df.to_excel(buf, index=False, engine="openpyxl")
            buf.seek(0)
            data = buf.read()
            content_type = (
                "application/"
                "vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            filename = f"export_{dataset_ref.id[:8]}.xlsx"
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return data, content_type, filename

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
        """
        ext = os.path.splitext(filename)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {ext}")

        try:
            if ext == ".csv":
                return self._parse_csv(file_storage)
            elif ext in (".xlsx", ".xls"):
                return self._parse_excel(file_storage, ext)
            else:
                raise ValueError(f"不支持的文件格式: {ext}")
        except Exception as e:
            raise ValueError(f"文件解析失败: {str(e)}")

    def _parse_csv(self, file_storage: Any) -> pd.DataFrame:
        """
        解析 CSV 文件，支持 UTF-8 和 GBK 编码自动检测。

        Args:
            file_storage: Flask 上传文件对象。

        Returns:
            解析后的 pandas DataFrame。

        Raises:
            ValueError: 解析失败时抛出。
        """
        encodings = ["utf-8", "gbk", "utf-8-sig", "gb2312"]
        last_exception = None

        for encoding in encodings:
            try:
                file_storage.seek(0)
                return pd.read_csv(file_storage, encoding=encoding)
            except Exception as e:
                last_exception = e
                continue

        raise ValueError(f"无法解析 CSV 文件，尝试了编码: {encodings}。错误: {str(last_exception)}")

    def _parse_excel(self, file_storage: Any, ext: str) -> pd.DataFrame:
        """
        解析 Excel 文件。

        Args:
            file_storage: Flask 上传文件对象。
            ext: 文件扩展名（.xlsx 或 .xls）。

        Returns:
            解析后的 pandas DataFrame。

        Raises:
            ValueError: 解析失败时抛出。
        """
        try:
            file_storage.seek(0)
            engine = "openpyxl" if ext == ".xlsx" else None
            return pd.read_excel(file_storage, engine=engine)
        except Exception as e:
            raise ValueError(f"Excel 文件解析失败: {str(e)}")
