"""
routes/plot.py - 图表生成路由
===============================
【层】控制层（Flask 路由）
【说明】POST /plot - 接收数据集标识、图表类型和坐标轴选择，调用可视化服务返回图表数据。
【负责人】可视化模块开发人员
"""

from flask import Blueprint, current_app, jsonify, request

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
#       "type": "scatter"    # "scatter" | "line" | "bar" | "pie"
#     }
#   成功响应 200:
#     { "status": "success", "data": { "plotly_json": {...} } }
#   失败响应 400/500:
#     { "status": "error", "message": "具体错误原因" }


@plot_bp.route("/plot", methods=["POST"])
def plot():
    """
    处理图表生成请求。

    解析 JSON 请求体，校验必填参数，调用 VisualizeService 生成 Plotly 图表。
    """
    params = request.get_json(silent=True)
    if not params:
        return jsonify({"status": "error", "message": "请求体不能为空"}), 400

    required = ["dataset_id", "x", "y", "type"]
    for field in required:
        if field not in params:
            return jsonify({"status": "error", "message": f"缺少参数: {field}"}), 400

    try:
        dataset_ref = DatasetRef(params["dataset_id"])
        visualize_service = current_app.visualize_service

        # 提取额外自定义参数（除必填字段外的所有字段，透传给 Service）
        extra = {k: v for k, v in params.items() if k not in required}

        result = visualize_service.generate_plot(
            dataset_ref, params["x"], params["y"], params["type"], **extra
        )
        return jsonify({"status": "success", "data": result})
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"服务器内部错误: {str(e)}"}), 500
