"""
routes/clean.py - 数据清洗路由
================================
【层】控制层（Flask 路由）
【说明】POST /clean - 接收数据集标识和清洗参数，调用清洗服务，返回新数据集标识和清洗报告。
【负责人】数据清洗模块开发人员
"""

from flask import Blueprint, jsonify, request

clean_bp = Blueprint("clean", __name__)

# ================================================================
# 路由处理器：清洗数据
# ================================================================
# 【HTTP 契约】
#   URL:    POST /clean
#   请求:
#     Content-Type: application/json
#     Body: {
#       "dataset_id": "a1b2c3...",
#       "missing": {"A": "mean", "B": "drop"},
#       "outlier": "iqr"
#     }
#   成功响应 200:
#     {
#       "status": "success",
#       "data": {
#         "dataset_id": "d4e5f6...",
#         "preview": [[...]],
#         "shape": [87, 5],
#         "report": {
#           "missing_handled": {"A": "填充了10个缺失值"},
#           "outliers_removed": 3,
#           "rows_before": 100,
#           "rows_after": 87
#         }
#       }
#     }
#   失败响应 400/500:
#     { "status": "error", "message": "具体错误原因" }


@clean_bp.route("/clean", methods=["POST"])
def clean():
    """
    处理数据清洗请求。

    从前端 JSON 中提取 dataset_id 构造 DatasetRef，获取清洗参数，
    调用 CleanService.clean() 执行清洗，返回新数据集引用和清洗报告。

    【待实现：数据清洗模块】
    - 解析 JSON 请求体中的 dataset_id、missing、outlier 参数
    - 构造 DatasetRef 对象
    - 获取 CleanService 实例并调用
    - 构造统一 JSON 响应
    """
    # ================================================================
    # 【待实现：数据清洗模块】
    # 1. 调用 request.get_json() 解析请求体
    # 2. 校验必填参数（dataset_id）
    # 3. 构造 DatasetRef(params["dataset_id"])
    # 4. 通过 current_app.clean_service 获取 CleanService 实例并调用 clean()
    # 5. 返回 JSON 响应
    # ================================================================
    raise NotImplementedError("数据清洗模块开发人员需实现 clean 路由")
