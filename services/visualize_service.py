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


# Plotly 预设配色方案
COLOR_SCHEMES = {
    "d3": px.colors.qualitative.D3,
    "set1": px.colors.qualitative.Set1,
    "set2": px.colors.qualitative.Set2,
    "pastel": px.colors.qualitative.Pastel,
    "dark24": px.colors.qualitative.Dark24,
    "plotly": px.colors.qualitative.Plotly,
    "g10": px.colors.qualitative.G10,
    "t10": px.colors.qualitative.T10,
}

DEFAULT_COLORS = px.colors.qualitative.D3

# 主题预设
THEME_LIGHT = {
    "plot_bgcolor": "#FAFAFA",
    "paper_bgcolor": "#FFFFFF",
    "font_color": "#333333",
    "grid_color": "#E5E5E5",
}

THEME_DARK = {
    "plot_bgcolor": "#0d1525",
    "paper_bgcolor": "#0d1525",
    "font_color": "#E8EDF4",
    "grid_color": "rgba(255,255,255,0.06)",
}


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

    自定义参数:
        通用: title, color_scheme, theme, axis_label_x, axis_label_y
        scatter: opacity, marker_size
        line: marker_size, line_width, fill_area, show_markers
        bar: aggregation, show_legend
        pie: pie_hole, pie_max_categories, show_legend, text_position, text_info
    """

    def __init__(self, repo: DataRepository):
        self.repo = repo

    def _resolve_colors(self, scheme_name):
        """根据名称解析配色方案，无效名称回退默认。"""
        if not isinstance(scheme_name, str):
            return DEFAULT_COLORS
        key = scheme_name.strip().lower()
        return COLOR_SCHEMES.get(key, DEFAULT_COLORS)

    def _resolve_theme(self, theme_name):
        """根据名称解析主题，默认亮色。"""
        if theme_name == "dark":
            return THEME_DARK
        return THEME_LIGHT

    def _apply_layout(self, fig, options, theme_override=None):
        """统一应用通用布局设置。"""
        theme_name = options.get("theme")
        theme = theme_override if theme_override else self._resolve_theme(theme_name)
        axis_label_x = options.get("axis_label_x")
        axis_label_y = options.get("axis_label_y")

        fig.update_layout(
            title_font=dict(size=16, family="SimHei", color=theme["font_color"]),
            xaxis_title=axis_label_x if axis_label_x else fig.layout.xaxis.title.text,
            yaxis_title=axis_label_y if axis_label_y else fig.layout.yaxis.title.text,
            xaxis_title_font=dict(size=12, family="SimHei", color=theme["font_color"]),
            yaxis_title_font=dict(size=12, family="SimHei", color=theme["font_color"]),
            plot_bgcolor=theme["plot_bgcolor"],
            paper_bgcolor=theme["paper_bgcolor"],
            font=dict(color=theme["font_color"]),
        )

        fig.update_xaxes(gridcolor=theme["grid_color"], zerolinecolor=theme["grid_color"])
        fig.update_yaxes(gridcolor=theme["grid_color"], zerolinecolor=theme["grid_color"])

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
        """
        df = self.repo.load_data(dataset_ref)

        if x_col not in df.columns:
            raise ValueError(f"列 '{x_col}' 不存在")
        if y_col not in df.columns:
            raise ValueError(f"列 '{y_col}' 不存在")

        if plot_type == "pie":
            if not pd.api.types.is_numeric_dtype(df[y_col]):
                raise ValueError(f"Y 列 '{y_col}' 必须是数值类型")
            plot_df = df[[x_col, y_col]].dropna()
            if plot_df.empty:
                raise ValueError("过滤后无可用数据（全为缺失值）")
        else:
            if not pd.api.types.is_numeric_dtype(df[x_col]):
                raise ValueError(f"X 列 '{x_col}' 必须是数值类型")
            if not pd.api.types.is_numeric_dtype(df[y_col]):
                raise ValueError(f"Y 列 '{y_col}' 必须是数值类型")
            plot_df = df[[x_col, y_col]].dropna()
            if plot_df.empty:
                raise ValueError("过滤后无可用数据（全为缺失值）")

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
        """生成散点图"""
        color_seq = self._resolve_colors(options.get("color_scheme"))
        fig = px.scatter(
            df,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 散点图",
            color_discrete_sequence=[color_seq[0]] if isinstance(color_seq, list) else [color_seq],
            opacity=options.get("opacity", 0.8),
        )

        self._apply_layout(fig, options)

        fig.update_layout(hovermode="closest")

        fig.update_traces(
            marker=dict(
                size=options.get("marker_size", 12),
                line=dict(width=2, color="white"),
            )
        )

        return {"plotly_json": fig.to_json()}

    def _line(self, df, x_col, y_col, **options) -> dict:
        """生成折线图"""
        color_seq = self._resolve_colors(options.get("color_scheme"))
        sort_x = options.get("sort_x", True)
        if sort_x:
            df = df.sort_values(by=x_col)

        show_markers = options.get("show_markers", True)
        line_width = options.get("line_width", 3)
        fill_area = options.get("fill_area", True)

        fig = px.line(
            df,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 折线图",
            markers=show_markers,
            color_discrete_sequence=[color_seq[0]] if isinstance(color_seq, list) else [color_seq],
        )

        self._apply_layout(fig, options)

        fig.update_layout(hovermode="x unified")

        fig.update_traces(
            marker=dict(
                size=options.get("marker_size", 10),
                line=dict(width=2, color="white"),
            ),
            line=dict(width=line_width),
        )

        if fill_area:
            rgb = self._hex_to_rgb(color_seq[0])
            fig.add_scatter(
                x=df[x_col],
                y=df[y_col],
                fill="tozeroy",
                fillcolor=f"rgba({rgb}, 0.1)",
                line=dict(width=0),
                showlegend=False,
            )

        return {"plotly_json": fig.to_json()}

    def _bar(self, df, x_col, y_col, **options) -> dict:
        """生成柱状图"""
        color_seq = self._resolve_colors(options.get("color_scheme"))
        aggregation = options.get("aggregation", "mean")
        show_legend = options.get("show_legend", False)

        agg_map = {
            "mean": df.groupby(x_col)[y_col].mean,
            "sum": df.groupby(x_col)[y_col].sum,
            "count": df.groupby(x_col)[y_col].count,
            "median": df.groupby(x_col)[y_col].median,
        }
        if aggregation not in agg_map:
            raise ValueError(f"不支持的聚合方式: {aggregation}")

        grouped = agg_map[aggregation]().reset_index()

        fig = px.bar(
            grouped,
            x=x_col,
            y=y_col,
            title=options.get("title") or f"{x_col} vs {y_col} 柱状图",
            color=x_col,
            color_discrete_sequence=color_seq if isinstance(color_seq, list) else [color_seq],
        )

        self._apply_layout(fig, options)

        fig.update_layout(showlegend=show_legend)

        fig.update_traces(
            marker=dict(line=dict(width=2, color="white"))
        )

        return {"plotly_json": fig.to_json()}

    def _pie(self, df, x_col, y_col, **options) -> dict:
        """生成饼图"""
        color_seq = self._resolve_colors(options.get("color_scheme"))
        max_categories = options.get("pie_max_categories", 10)
        show_legend = options.get("show_legend", True)
        text_position = options.get("text_position", "inside")
        text_info = options.get("text_info", "percent+label")

        grouped = df.groupby(x_col)[y_col].sum().reset_index()

        if len(grouped) > max_categories:
            top_n = grouped.nlargest(max_categories - 1, y_col)
            other_sum = grouped.loc[~grouped[x_col].isin(top_n[x_col]), y_col].sum()
            other_row = pd.DataFrame({x_col: ["其他"], y_col: [other_sum]})
            grouped = pd.concat([top_n, other_row], ignore_index=True)

        fig = px.pie(
            grouped,
            values=y_col,
            names=x_col,
            title=options.get("title") or f"{y_col} 按 {x_col} 分布",
            color_discrete_sequence=color_seq if isinstance(color_seq, list) else [color_seq],
            hole=options.get("pie_hole", 0.3),
        )

        # 饼图使用亮色纸背景保持可读性（除非显式要求暗色）
        pie_theme = THEME_LIGHT
        if options.get("theme") == "dark":
            pie_theme = THEME_DARK

        fig.update_layout(
            title_font=dict(size=16, family="SimHei", color=pie_theme["font_color"]),
            paper_bgcolor=pie_theme["paper_bgcolor"],
            legend_title_font=dict(size=12, family="SimHei"),
            legend=dict(font=dict(size=11)),
            showlegend=show_legend,
        )

        fig.update_traces(
            textposition=text_position,
            textinfo=text_info,
            marker=dict(line=dict(width=2, color="white")),
        )

        return {"plotly_json": fig.to_json()}

    def _hex_to_rgb(self, hex_color: str) -> str:
        """将颜色（hex 或 rgba）转换为逗号分隔的 RGB 字符串"""
        if not isinstance(hex_color, str):
            return "0, 212, 255"  # fallback: cyan
        hex_color = hex_color.strip()
        # 处理 rgba(r,g,b,a) 或 rgb(r,g,b)
        if hex_color.startswith("rgba(") or hex_color.startswith("rgb("):
            start = hex_color.index("(") + 1
            end = hex_color.index(")")
            parts = hex_color[start:end].split(",")
            return f"{parts[0].strip()}, {parts[1].strip()}, {parts[2].strip()}"
        # 处理 #RRGGBB
        hex_color = hex_color.lstrip("#")
        if len(hex_color) < 6:
            return "0, 212, 255"  # fallback
        return f"{int(hex_color[0:2], 16)}, {int(hex_color[2:4], 16)}, {int(hex_color[4:6], 16)}"