"""
services/visualize_service.py - 可视化服务
============================================
【层】业务逻辑层（Service）
【说明】提供图表生成功能，支持散点图、折线图、柱状图三种图表类型。
        内部加载数据集并生成图表，返回前端可渲染数据（base64 图片或 Plotly JSON）。
【负责人】可视化模块开发人员
"""

from repositories.base import DataRepository
from value_objects import DatasetRef


class VisualizeService:
    """
    可视化服务。

    支持图表类型（MVP）:
        - "scatter": 散点图
        - "line": 折线图
        - "bar": 柱状图

    【决策】可视化库由实现人员自行选择（Matplotlib / Plotly / Seaborn 等）。
            选择建议：
            - Matplotlib: 返回 base64 编码的 PNG 图片
            - Plotly: 返回 Plotly JSON（前端 Plotly.js 渲染，交互性更强）
    """

    def __init__(self, repo: DataRepository):
        """
        通过构造函数注入 DataRepository 抽象。

        Args:
            repo: 数据仓库实例。
        """
        self.repo = repo

    def generate_plot(
        self,
        dataset_ref: DatasetRef,
        x_col: str,
        y_col: str,
        plot_type: str,
    ) -> dict:
        """
        生成图表数据。

        Args:
            dataset_ref: 数据集引用。
            x_col: X 轴列名。
            y_col: Y 轴列名。
            plot_type: 图表类型，支持 "scatter" | "line" | "bar"。

        Returns:
            若使用 Matplotlib:
                {"image_base64": "iVBORw0..."} (base64 编码的 PNG)
            若使用 Plotly:
                {"plotly_json": {...}} (Plotly Figure JSON，前端用 Plotly.js 渲染)

        Raises:
            ValueError: 当指定的列不存在于数据集中时抛出。
            ValueError: 当 plot_type 不支持时抛出。

        【待实现：可视化模块】
        - 选择可视化库（Matplotlib / Plotly / Seaborn）
        - 验证 x_col 和 y_col 是否存在于数据集中
        - 确保数值列用于绘图，非数值列应给出明确错误信息
        - 处理缺失值（可以跳过 NaN 行或给出提示）
        - 图表样式基本配置（标题、坐标轴标签）
        """
        # ================================================================
        # 【待实现：可视化模块】实现图表生成逻辑
        # 1. 通过 self.repo.load_data(dataset_ref) 加载数据
        # 2. 校验 x_col 和 y_col 是否存在
        # 3. 根据 plot_type 选择图表类型生成
        # 4. 返回 base64 图片或 Plotly JSON
        # ================================================================
        raise NotImplementedError("可视化模块开发人员需实现 generate_plot 方法")
