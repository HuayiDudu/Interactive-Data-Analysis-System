"""
routes/export.py - 数据导出路由
=================================
【层】控制层（Flask 路由）
【说明】GET /export - 接收数据集标识及导出格式，调用 DataService 导出文件流。
【负责人】数据管理模块开发人员
"""

from flask import Blueprint, Response, current_app, jsonify, request

from value_objects import DatasetRef

export_bp = Blueprint("export", __name__)


@export_bp.route("/export", methods=["GET"])
def export():
    """
    处理数据导出请求。

    通过 DataService.export_data() 获取文件数据，构造文件流响应。
    """
    dataset_id = request.args.get("dataset_id")
    fmt = request.args.get("format", "csv")

    if not dataset_id:
        return jsonify({"status": "error", "message": "缺少 dataset_id"}), 400

    if fmt not in ("csv", "xlsx"):
        return jsonify({"status": "error", "message": f"不支持的导出格式: {fmt}"}), 400

    try:
        ref = DatasetRef(dataset_id)
        data_service = current_app.data_service
        data, content_type, filename = data_service.export_data(ref, fmt)

        return Response(
            data,
            mimetype=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"导出失败: {str(e)}"}), 500
