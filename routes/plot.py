"""
routes/plot.py - 图表生成路由
===============================
【层】控制层（Flask 路由）
【说明】POST /plot - 接收数据集标识、图表类型和坐标轴选择，调用可视化服务返回图表数据。
【负责人】可视化模块开发人员
"""

from flask import Blueprint, jsonify, request

from services.visualize_service import VisualizeService
from value_objects import DatasetRef

plot_bp = Blueprint("plot", __name__)

# ================================================================
# 路由处理器：生成图表
# ================================================================
# 【HTTP 契约】
#   URL:    POST /plot
#   请求:
#     Content-Type: application/json
#     Body: {
#       "dataset_id": "d4e5f6...",
#       "x": "A",
#       "y": "B",
#       "type": "scatter"   # "scatter" | "line" | "bar"
#     }
#   成功响应 200 （Matplotlib 模式）:
#     {
#       "status": "success",
#       "data": { "image_base64": "iVBORw0..." }
#     }
#   成功响应 200 （Plotly 模式）:
#     {
#       "status": "success",
#       "data": { "plotly_json": {...} }
#     }
#   失败响应 400/500:
#     { "status": "error", "message": "具体错误原因" }


@plot_bp.route("/plot", methods=["POST"])
def plot():
    """
    处理图表生成请求。

    根据前端传递的 dataset_id、x/y 列名和图表类型，生成并返回图表数据。

    【待实现：可视化模块】
    - 解析 JSON 请求体
    - 校验必填参数（dataset_id, x, y, type）
    - 验证图表类型是否在支持范围内
    - 获取 VisualizeService 实例并调用
    """
    # ================================================================
    # 【待实现：可视化模块】
    # 1. 调用 request.get_json()
    # 2. 校验必填参数（dataset_id, x, y, type）
    # 3. 构造 DatasetRef
    # 4. 通过 current_app.visualize_service 获取 VisualizeService 实例并调用
    # 5. 返回 JSON 响应
    # ================================================================
    raise NotImplementedError("可视化模块开发人员需实现 plot 路由")
