"""
services/visualize_service.py - 可视化服务
============================================
【层】业务逻辑层（Service）
【说明】提供图表生成功能，支持散点图、折线图、柱状图、饼图四种图表类型。
        内部加载数据集并生成图表，返回前端可渲染数据（base64 图片或 Plotly JSON）。
【负责人】可视化模块开发人员
"""
import base64
from io import BytesIO
import matplotlib
# 非交互式后端，服务器环境必须
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from repositories.base import DataRepository
from value_objects import DatasetRef


# 全局中文/负号设置（避免乱码）
plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 高级配色方案
# 参考现代数据可视化配色：莫兰迪色系、渐变色、专业配色
COLOR_SCHEMES = {
    # 主色调 - 深蓝/青色系
    'primary': '#3B82F6',
    'primary_light': '#60A5FA',
    'primary_dark': '#2563EB',
    
    # 辅助色
    'secondary': '#10B981',
    'accent': '#8B5CF6',
    'warning': '#F59E0B',
    'danger': '#EF4444',
    
    # 莫兰迪色系 - 柔和优雅
    'morandi': [
        '#8B7355', '#C4B7A6', '#A8A495', 
        '#B8A995', '#C9B896', '#D4C4A8',
        '#A59478', '#B8A898', '#C4B5A0',
        '#9B8B7A'
    ],
    
    # 现代渐变色系 - 专业感
    'modern': [
        '#3B82F6', '#10B981', '#8B5CF6', 
        '#F59E0B', '#EF4444', '#EC4899',
        '#06B6D4', '#84CC16', '#F97316',
        '#6366F1'
    ],
    
    # 冷色系 - 科技感
    'cool': [
        '#0EA5E9', '#06B6D4', '#0DCB7D',
        '#22D3EE', '#38BDF8', '#5EEAD4',
        '#34D399', '#6EE7B7', '#A7F3D0'
    ],
    
    # 暖色/对比色系 - 强调重点
    'warm': [
        '#F97316', '#FB923C', '#FDBA74',
        '#EF4444', '#F87171', '#FCA5A5',
        '#F59E0B', '#FBBF24', '#FCD34D'
    ]
}


class VisualizeService:
    """
    可视化服务。

    支持图表类型:
        - "scatter": 散点图
        - "line": 折线图
        - "bar": 柱状图
        - "pie": 饼图

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
            x_col: X 轴列名（饼图时为分类列）。
            y_col: Y 轴列名（饼图时为数值列）。
            plot_type: 图表类型，支持 "scatter" | "line" | "bar" | "pie"。

        Returns:
            若使用 Matplotlib:
                {"image_base64": "iVBORw0..."} (base64 编码的 PNG)
            若使用 Plotly:
                {"plotly_json": {...}} (Plotly Figure JSON，前端用 Plotly.js 渲染)

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

        # 4. 分发绘图
        if plot_type == "scatter":
            return self._scatter(plot_df, x_col, y_col)
        elif plot_type == "line":
            return self._line(plot_df, x_col, y_col)
        elif plot_type == "bar":
            return self._bar(plot_df, x_col, y_col)
        elif plot_type == "pie":
            return self._pie(plot_df, x_col, y_col)
        else:
            raise ValueError(f"不支持的图表类型: {plot_type}")

    def _scatter(self, df, x_col, y_col) -> dict:
        """
        生成散点图 - 使用渐变配色
        """
        fig, ax = plt.subplots(figsize=(8, 5), dpi=100)
        
        # 创建颜色渐变效果
        colors = plt.cm.Blues_r(df[y_col] / df[y_col].max())
        
        # 绘制散点，使用现代配色
        scatter = ax.scatter(
            df[x_col], 
            df[y_col], 
            alpha=0.8,
            s=100,  # 点的大小
            c=COLOR_SCHEMES['primary'],
            edgecolor='white',
            linewidth=1.5,
            zorder=5
        )
        
        # 设置坐标轴标签和标题
        ax.set_xlabel(x_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_ylabel(y_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_title(f"{x_col} vs {y_col} 散点图", fontsize=14, fontweight='bold', pad=15)
        
        # 美化网格
        ax.grid(True, alpha=0.2, linestyle='--', color='#E5E7EB')
        ax.set_facecolor('#FAFAFA')
        
        # 添加颜色条（可选）
        # plt.colorbar(scatter, ax=ax, label=y_col)
        
        return self._fig_to_base64(fig)

    def _line(self, df, x_col, y_col) -> dict:
        """
        生成折线图 - 使用渐变色线
        """
        fig, ax = plt.subplots(figsize=(8, 5), dpi=100)
        sorted_df = df.sort_values(by=x_col)
        
        # 使用渐变色绘制折线
        line, = ax.plot(
            sorted_df[x_col], 
            sorted_df[y_col], 
            marker='o',
            markerfacecolor=COLOR_SCHEMES['primary'],
            markeredgecolor='white',
            markeredgewidth=2,
            markersize=8,
            linewidth=2.5,
            color=COLOR_SCHEMES['primary'],
            alpha=0.9
        )
        
        # 添加数据点标签（可选）
        # for i, (x, y) in enumerate(zip(sorted_df[x_col], sorted_df[y_col])):
        #     ax.annotate(f'{y:.1f}', (x, y), textcoords='offset points', xytext=(0, 5), ha='center')
        
        # 设置坐标轴标签和标题
        ax.set_xlabel(x_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_ylabel(y_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_title(f"{x_col} vs {y_col} 折线图", fontsize=14, fontweight='bold', pad=15)
        
        # 美化网格
        ax.grid(True, alpha=0.2, linestyle='--', color='#E5E7EB')
        ax.set_facecolor('#FAFAFA')
        
        # 添加阴影效果（可选）
        ax.fill_between(
            sorted_df[x_col], 
            sorted_df[y_col], 
            alpha=0.1,
            color=COLOR_SCHEMES['primary']
        )
        
        return self._fig_to_base64(fig)

    def _bar(self, df, x_col, y_col) -> dict:
        """
        生成柱状图 - 使用现代渐变色
        """
        fig, ax = plt.subplots(figsize=(8, 5), dpi=100)
        grouped = df.groupby(x_col)[y_col].mean().reset_index()
        
        # 使用现代配色方案
        colors = COLOR_SCHEMES['modern']
        bar_colors = [colors[i % len(colors)] for i in range(len(grouped))]
        
        # 绘制柱状图
        bars = ax.bar(
            grouped[x_col].astype(str), 
            grouped[y_col],
            color=bar_colors,
            edgecolor='white',
            linewidth=1,
            alpha=0.85,
            width=0.7
        )
        
        # 设置坐标轴标签和标题
        ax.set_xlabel(x_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_ylabel(y_col, fontsize=12, fontweight='medium', labelpad=10)
        ax.set_title(f"{x_col} vs {y_col} 柱状图", fontsize=14, fontweight='bold', pad=15)
        
        # 美化网格
        ax.grid(True, alpha=0.2, linestyle='--', color='#E5E7EB', axis='y')
        ax.set_facecolor('#FAFAFA')
        
        # 设置X轴标签旋转
        ax.tick_params(axis='x', rotation=45, labelsize=10)
        
        # 添加数值标签
        for bar in bars:
            height = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2.,
                height,
                f'{height:.1f}',
                ha='center',
                va='bottom',
                fontsize=10,
                fontweight='medium'
            )
        
        return self._fig_to_base64(fig)

    def _pie(self, df, x_col, y_col) -> dict:
        """
        生成饼图 - 使用现代配色方案
        """
        # 按分类列分组并求和
        grouped = df.groupby(x_col)[y_col].sum().reset_index()
        
        # 如果分类太多，只显示前 10 个，其余归为"其他"
        if len(grouped) > 10:
            top_n = grouped.nlargest(9, y_col)
            other_sum = grouped.loc[~grouped[x_col].isin(top_n[x_col]), y_col].sum()
            other_row = pd.DataFrame({x_col: ['其他'], y_col: [other_sum]})
            grouped = pd.concat([top_n, other_row], ignore_index=True)
        
        # 创建饼图
        fig, ax = plt.subplots(figsize=(8, 8), dpi=100)
        
        # 使用现代配色方案
        colors = COLOR_SCHEMES['modern'][:len(grouped)]
        
        # 绘制饼图，添加阴影和立体感
        wedges, texts, autotexts = ax.pie(
            grouped[y_col],
            labels=grouped[x_col],
            autopct='%1.1f%%',
            startangle=90,
            colors=colors,
            shadow=True,
            explode=[0.05 if i == 0 else 0 for i in range(len(grouped))],  # 第一个扇区稍微突出
            textprops={'fontsize': 11, 'fontweight': 'medium'},
            wedgeprops={
                'edgecolor': 'white',
                'linewidth': 2
            }
        )
        
        # 设置标题
        ax.set_title(
            f"{y_col} 按 {x_col} 分布", 
            fontsize=14, 
            fontweight='bold', 
            pad=20
        )
        
        # 设置图例
        ax.legend(
            wedges, 
            grouped[x_col],
            loc='center left',
            bbox_to_anchor=(1.05, 0.5),
            fontsize=10,
            title=x_col,
            title_fontsize=12
        )
        
        # 设置背景色
        fig.patch.set_facecolor('#FAFAFA')
        
        return self._fig_to_base64(fig)

    def _fig_to_base64(self, fig) -> dict:
        """
        将 Matplotlib 图表转换为 base64 编码的 PNG 图片。

        Args:
            fig: Matplotlib 图表实例。

        Returns:
            {"image_base64": "iVBORw0..."} (base64 编码的 PNG)
        """
        buf = BytesIO()
        fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
        plt.close(fig)  # 释放内存
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode("utf-8")
        return {"image_base64": img_b64}