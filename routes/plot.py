from flask import Blueprint, request, jsonify, current_app
from value_objects import DatasetRef

# 创建蓝图（需在 Flask 主应用中注册）
plot_bp = Blueprint("plot", __name__)

@plot_bp.route("/plot", methods=["POST"])
def plot():
    params = request.get_json()

    # 校验必填字段
    required = ["dataset_id", "x", "y", "type"]
    for field in required:
        if field not in params:
            return jsonify({"status": "error", "message": f"缺少参数: {field}"}), 400

    try:
        dataset_ref = DatasetRef(params["dataset_id"])
        visualize_service = current_app.visualize_service

        result = visualize_service.generate_plot(
            dataset_ref, params["x"], params["y"], params["type"]
        )
        return jsonify({"status": "success", "data": result})
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"服务器内部错误: {str(e)}"}), 500