"""
services/visualize_service.py - 可视化服务
============================================
【层】业务逻辑层（Service）
【说明】提供图表生成功能，支持散点图、折线图、柱状图、饼图四种图表类型。
        使用 Plotly 生成交互式图表，返回 Plotly Figure JSON，前端用 Plotly.js 渲染。
【负责人】可视化模块开发人员
"""
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from repositories.base import DataRepository
from value_objects import DatasetRef


# Plotly 配色方案 - 现代专业配色
PLOTLY_COLORS = px.colors.qualitative.D3  # 使用 D3 配色方案


class VisualizeService:
    """
    可视化服务。

    支持图表类型:
        - "scatter": 散点图
        - "line": 折线图
        - "bar": 柱状图
        - "pie": 饼图

    返回格式:
        {"plotly_json": {...}} - Plotly Figure JSON，前端用 Plotly.js 渲染
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
        **options,
    ) -> dict:
        """
        生成图表数据。

        Args:
            dataset_ref: 数据集引用。
            x_col: X 轴列名（饼图时为分类列）。
            y_col: Y 轴列名（饼图时为数值列）。
            plot_type: 图表类型，支持 "scatter" | "line" | "bar" | "pie"。
            **options: 自定义参数，不传则使用默认值。
                通用: title, color_scheme
                scatter: opacity, marker_size
                line: marker_size
                bar: aggregation (mean|sum|count|median)
                pie: pie_hole, pie_max_categories

        Returns:
            {"plotly_json": {...}} - Plotly Figure JSON

        Raises:
            ValueError: 当指定的列不存在于数据集中时抛出。
            ValueError: 当 plot_type 不支持时抛出。
        """
        # 1. 加载数据
        df = self.repo.load_data(dataset_ref)

        # 2. 校验列存在
        if x_col not in df.columns:
            raise ValueError(f"列 '{x_col}' 不存在")
        if y_col not in df.columns:
            raise ValueError(f"列 '{y_col}' 不存在")

        # 3. 根据图表类型进行不同的校验
        if plot_type == "pie":
            # 饼图：x_col 为分类列，y_col 为数值列
            if not pd.api.types.is_numeric_dtype(df[y_col]):
                raise ValueError(f"Y 列 '{y_col}' 必须是数值类型")
            # 剔除缺失值
            plot_df = df[[x_col, y_col]].dropna()
            if plot_df.empty:
                raise ValueError("过滤后无可用数据（全为缺失值）")
        else:
            # 散点图、折线图、柱状图：两个列都必须是数值类型
            if not pd.api.types.is_numeric_dtype(df[x_col]):
                raise ValueError(f"X 列 '{x_col}' 必须是数值类型")
            if not pd.api.types.is_numeric_dtype(df[y_col]):
                raise ValueError(f"Y 列 '{y_col}' 必须是数值类型")
            # 剔除缺失值
            plot_df = df[[x_col, y_col]].dropna()
            if plot_df.empty:
                raise ValueError("过滤后无可用数据（全为缺失值）")

        # 4. 分发绘图，透传自定义参数
        if plot_type == "scatter":
            return self._scatter(plot_df, x_col, y_col, **options)
        elif plot_type == "line":
            return self._line(plot_df, x_col, y_col, **options)
        elif plot_type == "bar":
            return self._bar(plot_df, x_col, y_col, **options)
        elif plot_type == "pie":
            return self._pie(plot_df, x_col, y_col, **options)
        else:
            raise ValueError(f"不支持的图表类型: {plot_type}")

    def _scatter(self, df, x_col, y_col, **options) -> dict:
        """
        生成散点图 - 使用 Plotly
        """
        color_seq = options.get("color_scheme", PLOTLY_COLORS)
        fig = px.scatter(
            df,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 散点图",
            color_discrete_sequence=[color_seq[0]] if isinstance(color_seq, list) else [color_seq],
            opacity=options.get("opacity", 0.8)
        )

        fig.update_layout(
            title_font=dict(size=16, family='SimHei'),
            xaxis_title_font=dict(size=12, family='SimHei'),
            yaxis_title_font=dict(size=12, family='SimHei'),
            plot_bgcolor='#FAFAFA',
            paper_bgcolor='#FFFFFF',
            hovermode='closest'
        )

        fig.update_traces(
            marker=dict(
                size=options.get("marker_size", 12),
                line=dict(width=2, color='white')
            )
        )

        return {"plotly_json": fig.to_json()}

    def _line(self, df, x_col, y_col, **options) -> dict:
        """
        生成折线图 - 使用 Plotly
        """
        color_seq = options.get("color_scheme", PLOTLY_COLORS)
        sorted_df = df.sort_values(by=x_col)

        fig = px.line(
            sorted_df,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 折线图",
            markers=True,
            color_discrete_sequence=[color_seq[0]] if isinstance(color_seq, list) else [color_seq]
        )

        fig.update_layout(
            title_font=dict(size=16, family='SimHei'),
            xaxis_title_font=dict(size=12, family='SimHei'),
            yaxis_title_font=dict(size=12, family='SimHei'),
            plot_bgcolor='#FAFAFA',
            paper_bgcolor='#FFFFFF',
            hovermode='x unified'
        )

        fig.update_traces(
            marker=dict(
                size=options.get("marker_size", 10),
                line=dict(width=2, color='white')
            ),
            line=dict(width=3)
        )

        fig.add_scatter(
            x=sorted_df[x_col],
            y=sorted_df[y_col],
            fill='tozeroy',
            fillcolor=f'rgba({self._hex_to_rgb(color_seq[0])}, 0.1)',
            line=dict(width=0),
            showlegend=False
        )

        return {"plotly_json": fig.to_json()}

    def _bar(self, df, x_col, y_col, **options) -> dict:
        """
        生成柱状图 - 使用 Plotly
        """
        color_seq = options.get("color_scheme", PLOTLY_COLORS)
        aggregation = options.get("aggregation", "mean")

        if aggregation == "mean":
            grouped = df.groupby(x_col)[y_col].mean().reset_index()
        elif aggregation == "sum":
            grouped = df.groupby(x_col)[y_col].sum().reset_index()
        elif aggregation == "count":
            grouped = df.groupby(x_col)[y_col].count().reset_index()
        elif aggregation == "median":
            grouped = df.groupby(x_col)[y_col].median().reset_index()
        else:
            raise ValueError(f"不支持的聚合方式: {aggregation}")

        fig = px.bar(
            grouped,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 柱状图",
            color=x_col,
            color_discrete_sequence=color_seq if isinstance(color_seq, list) else [color_seq]
        )

        fig.update_layout(
            title_font=dict(size=16, family='SimHei'),
            xaxis_title_font=dict(size=12, family='SimHei'),
            yaxis_title_font=dict(size=12, family='SimHei'),
            plot_bgcolor='#FAFAFA',
            paper_bgcolor='#FFFFFF',
            showlegend=False
        )

        fig.update_traces(
            marker=dict(
                line=dict(width=2, color='white')
            )
        )

        return {"plotly_json": fig.to_json()}

    def _pie(self, df, x_col, y_col, **options) -> dict:
        """
        生成饼图 - 使用 Plotly
        """
        color_seq = options.get("color_scheme", PLOTLY_COLORS)
        max_categories = options.get("pie_max_categories", 10)

        grouped = df.groupby(x_col)[y_col].sum().reset_index()

        if len(grouped) > max_categories:
            top_n = grouped.nlargest(max_categories - 1, y_col)
            other_sum = grouped.loc[~grouped[x_col].isin(top_n[x_col]), y_col].sum()
            other_row = pd.DataFrame({x_col: ['其他'], y_col: [other_sum]})
            grouped = pd.concat([top_n, other_row], ignore_index=True)

        fig = px.pie(
            grouped,
            values=y_col,
            names=x_col,
            title=options.get("title") or f"{y_col} 按 {x_col} 分布",
            color_discrete_sequence=color_seq if isinstance(color_seq, list) else [color_seq],
            hole=options.get("pie_hole", 0.3)
        )

        fig.update_layout(
            title_font=dict(size=16, family='SimHei'),
            paper_bgcolor='#FFFFFF',
            legend_title_font=dict(size=12, family='SimHei'),
            legend=dict(font=dict(size=11))
        )

        fig.update_traces(
            textposition='inside',
            textinfo='percent+label',
            marker=dict(
                line=dict(width=2, color='white')
            )
        )

        return {"plotly_json": fig.to_json()}

    def _hex_to_rgb(self, hex_color: str) -> str:
        """
        将十六进制颜色转换为 RGB 字符串
        """
        hex_color = hex_color.lstrip('#')
        return f"{int(hex_color[0:2], 16)}, {int(hex_color[2:4], 16)}, {int(hex_color[4:6], 16)}"