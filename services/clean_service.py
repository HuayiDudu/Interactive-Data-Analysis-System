"""
services/clean_service.py - 数据清洗服务
==========================================
【层】业务逻辑层（Service）
【说明】提供缺失值处理和异常值检测功能。
        内部通过数据访问层加载数据，执行清洗后保存为新数据集，
        返回新引用、预览和清洗报告。原始数据保持不变（不可变数据操作）。
【负责人】数据清洗模块开发人员
"""

import numpy as np
import pandas as pd

from repositories.base import DataRepository
from value_objects import DatasetRef


class CleanService:
    """
    数据清洗服务。

    支持缺失值处理（均值填充、中位数填充、删除行）和异常值检测（IQR 方法）。
    每次清洗操作产生新的数据集，不修改原始数据。
    """

    def __init__(self, repo: DataRepository):
        """
        通过构造函数注入 DataRepository 抽象。

        Args:
            repo: 数据仓库实例。
        """
        self.repo = repo

    def clean(
        self,
        dataset_ref: DatasetRef,
        missing_strategy: dict,
        outlier_method: str | None,
    ) -> tuple[DatasetRef, list, dict]:
        """
        执行数据清洗操作。

        Args:
            dataset_ref: 原始数据集引用。
            missing_strategy:
                缺失值处理策略字典，格式如 {"列名": "mean" | "median" | "drop"}。
                示例: {"A": "mean", "B": "drop"}
            outlier_method:
                异常值检测方法，当前支持:
                - "iqr": 使用 IQR 方法检测并移除异常值
                - None: 不进行异常值处理

        Returns:
            (new_ref, preview_list, report_dict) 元组。
            preview_list: 清洗后数据的前 5 行（列表的列表）。
            report_dict: 清洗报告，包含:
                - "missing_handled": {"列名": "处理描述"}
                - "outliers_removed": int（移除的异常值行数）
                - "rows_before": int（清洗前行数）
                - "rows_after": int（清洗后行数）
        """
        # 1. 加载原始数据
        df = self.repo.load_data(dataset_ref)
        rows_before = len(df)
        report: dict = {}

        # 2. 处理缺失值
        if missing_strategy:
            df, missing_report = self._handle_missing(df, missing_strategy)
            report["missing_handled"] = missing_report

        # 3. 异常值检测
        outliers_removed = 0
        if outlier_method == "iqr":
            df, outliers_removed = self._detect_outliers_iqr(df)

        report["outliers_removed"] = outliers_removed
        report["rows_before"] = rows_before
        report["rows_after"] = len(df)

        # 4. 保存清洗结果为新数据集
        new_ref = self.repo.save_data(df)

        # 5. 构造预览（NaN 转 None 保持 JSON 合法）
        preview = []
        for _, row in df.head(5).iterrows():
            preview.append([None if pd.isna(v) else v for v in row])

        return new_ref, preview, report

    def _handle_missing(
        self, df: pd.DataFrame, strategy: dict
    ) -> tuple[pd.DataFrame, dict]:
        """
        处理缺失值。

        Args:
            df: 原始 DataFrame。
            strategy: 缺失值策略字典，格式 {"列名": "mean" | "median" | "drop"}。

        Returns:
            (cleaned_df, report_dict) — 清洗后的 DataFrame 和缺失值处理报告。
            报告格式: {"列名": "均值填充了 X 个缺失值", ...}

        Raises:
            ValueError: 非数值列使用 mean/median、列全为 NaN 时抛出。
        """
        df = df.copy()
        report: dict = {}

        for col, strat in strategy.items():
            if col not in df.columns:
                continue

            if strat == "mean":
                # 检查是否为数值列
                if not pd.api.types.is_numeric_dtype(df[col]):
                    raise ValueError(
                        f"列 '{col}' 不是数值类型，无法使用均值填充"
                    )
                nan_count = int(df[col].isna().sum())
                if nan_count > 0:
                    # 检查是否全为缺失值
                    if nan_count == len(df[col]):
                        raise ValueError(
                            f"列 '{col}' 全为缺失值，无法计算均值"
                        )
                    df[col] = df[col].fillna(df[col].mean())
                    report[col] = f"均值填充了 {nan_count} 个缺失值"

            elif strat == "median":
                # 检查是否为数值列
                if not pd.api.types.is_numeric_dtype(df[col]):
                    raise ValueError(
                        f"列 '{col}' 不是数值类型，无法使用中位数填充"
                    )
                nan_count = int(df[col].isna().sum())
                if nan_count > 0:
                    # 检查是否全为缺失值
                    if nan_count == len(df[col]):
                        raise ValueError(
                            f"列 '{col}' 全为缺失值，无法计算中位数"
                        )
                    df[col] = df[col].fillna(df[col].median())
                    report[col] = f"中位数填充了 {nan_count} 个缺失值"

            elif strat == "drop":
                nan_count = int(df[col].isna().sum())
                if nan_count > 0:
                    df = df.dropna(subset=[col])
                    report[col] = f"删除了 {nan_count} 个包含缺失值的行"

            # 其他策略: 忽略

        return df, report

    def _detect_outliers_iqr(
        self, df: pd.DataFrame
    ) -> tuple[pd.DataFrame, int]:
        """
        使用 IQR 方法检测并移除异常值。

        对所有数值列计算 Q1、Q3 和 IQR，移除任一数值列超出
        [Q1 - 1.5*IQR, Q3 + 1.5*IQR] 范围的行。

        Args:
            df: 输入的 DataFrame。

        Returns:
            (cleaned_df, count) — 移除异常值后的 DataFrame 和移除的行数。
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) == 0:
            return df, 0

        outlier_mask = pd.Series(False, index=df.index)

        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            outlier_mask |= (df[col] < lower) | (df[col] > upper)

        count = int(outlier_mask.sum())
        df_clean = df[~outlier_mask].reset_index(drop=True)
        return df_clean, count
