"""
services/clean_service.py - 数据清洗服务
==========================================
【层】业务逻辑层（Service）
【说明】提供缺失值处理和异常值检测功能。
        内部通过数据访问层加载数据，执行清洗后保存为新数据集，
        返回新引用、预览和清洗报告。原始数据保持不变（不可变数据操作）。
【负责人】数据清洗模块开发人员
"""

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

        【待实现】
        - 缺失值处理：
          - "mean": 用该列均值填充（仅数值列）
          - "median": 用该列中位数填充（仅数值列）
          - "drop": 删除包含缺失值的行
        - 异常值检测（IQR 方法）：
          - 对所有数值列计算 Q1、Q3 和 IQR
          - 移除超出 [Q1 - 1.5*IQR, Q3 + 1.5*IQR] 范围的行
          - 注意：IQR 适用于数值列，非数值列应跳过
        - 每次清洗后通过 self.repo.save_data() 保存新数据集
        """
        # ================================================================
        # 【待实现：数据清洗模块】实现清洗逻辑
        # 1. 通过 self.repo.load_data(dataset_ref) 加载原始数据
        # 2. 遍历 missing_strategy 处理各列的缺失值
        # 3. 如果 outlier_method == "iqr"，执行异常值检测和移除
        # 4. 通过 self.repo.save_data(cleaned_df) 保存清洗结果
        # 5. 构造预览和报告
        # 6. 返回 (new_ref, preview, report)
        # ================================================================
        raise NotImplementedError("数据清洗模块开发人员需实现 clean 方法")

    def _handle_missing(self, df, strategy: dict) -> tuple:
        """
        处理缺失值。

        Args:
            df: 原始 DataFrame。
            strategy: 缺失值策略字典。

        Returns:
            (cleaned_df, report_dict_part) — 清洗后的 DataFrame 和缺失值处理报告。

        【待实现：数据清洗模块】
        - "mean": 检查列是否为数值型，然后填充均值
        - "median": 检查列是否为数值型，然后填充中位数
        - "drop": 删除包含 NaN 的行（可定位到特定列的子集）
        """
        raise NotImplementedError("数据清洗模块开发人员需实现 _handle_missing")

    def _detect_outliers_iqr(self, df: pd.DataFrame) -> tuple:
        """
        使用 IQR 方法检测并移除异常值。

        Args:
            df: 输入的 DataFrame。

        Returns:
            (cleaned_df, count) — 移除异常值后的 DataFrame 和移除的行数。

        【待实现：数据清洗模块】
        - 仅对数值列进行操作
        - IQR = Q3 - Q1
        - 下界 = Q1 - 1.5 * IQR, 上界 = Q3 + 1.5 * IQR
        """
        raise NotImplementedError("数据清洗模块开发人员需实现 _detect_outliers_iqr")
