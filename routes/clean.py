"""
routes/clean.py - 数据清洗路由
================================
【层】控制层（Flask 路由）
【说明】POST /clean - 接收数据集标识和清洗参数，调用清洗服务，返回新数据集标识和清洗报告。
【负责人】数据清洗模块开发人员
"""

from flask import Blueprint, current_app, jsonify, request, session

from value_objects import DatasetRef

clean_bp = Blueprint("clean", __name__)


@clean_bp.route("/clean", methods=["POST"])
def clean():
    """
    处理数据清洗请求。

    请求体 JSON:
        {
            "dataset_id": "a1b2c3...",
            "missing": {"列名": "mean" | "median" | "drop"},
            "outlier": "iqr" | null
        }

    成功响应:
        {
            "status": "success",
            "data": {
                "dataset_id": "新数据集ID",
                "preview": [[...], ...],
                "shape": [行数, 列数],
                "report": {
                    "missing_handled": {"列名": "处理描述"},
                    "outliers_removed": int,
                    "rows_before": int,
                    "rows_after": int
                }
            }
        }
    """
    params = request.get_json()

    # 校验必填字段
    if "dataset_id" not in params:
        return jsonify({"status": "error", "message": "缺少 dataset_id"}), 400

    dataset_ref = DatasetRef(params["dataset_id"])
    missing = params.get("missing", {})
    outlier = params.get("outlier")

    # 调用 Service
    clean_service = current_app.clean_service
    try:
        new_ref, preview, report = clean_service.clean(
            dataset_ref, missing, outlier, user_id=session.get("user_id")
        )
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    return jsonify({
        "status": "success",
        "data": {
            "dataset_id": new_ref.id,
            "preview": preview,
            "report": report,
            "shape": [
                report["rows_after"],
                len(preview[0]) if preview else 0,
            ],
        }
    })
