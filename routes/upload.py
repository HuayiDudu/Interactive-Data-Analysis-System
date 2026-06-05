"""
routes/upload.py - 文件上传路由
=================================
【层】控制层（Flask 路由）
【说明】POST /upload - 接收上传的 CSV/Excel 文件，调用业务层解析并保存。
【负责人】数据管理模块开发人员
"""

from flask import Blueprint, current_app, jsonify, request, session

upload_bp = Blueprint("upload", __name__)

# ================================================================
# 路由处理器：上传文件
# ================================================================
# 【HTTP 契约】
#   URL:    POST /upload
#   请求:   Content-Type: multipart/form-data, field: file
#   成功响应 200:
#     {
#       "status": "success",
#       "data": {
#         "dataset_id": "a1b2c3...",
#         "columns": ["A", "B"],
#         "preview": [[1, 2]],
#         "shape": [100, 2],
#         "dtypes": {"A": "int64", "B": "float64"}
#       }
#     }
#   失败响应 400/500:
#     { "status": "error", "message": "具体错误原因" }


# 【待实现】如果使用蓝图 + 构造函数的模式，需要应用工厂在注册时注入依赖。
# 两种方案:
#   方案 A: 在路由函数中从 app.config 或全局变量获取 service 实例
#   方案 B: 使用 current_app 或 LocalProxy 获取 service
# 推荐在 create_app() 中将 service 实例设为 app 的属性，在此处通过 current_app 获取。


@upload_bp.route("/upload", methods=["POST"])
def upload():
    """
    处理文件上传请求。

    从 multipart 请求中获取文件，调用 DataService.upload() 解析并保存，
    返回数据集标识和预览信息。
    """
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "未找到上传文件"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "文件名为空"}), 400

    try:
        data_service = current_app.data_service
        dataset_ref, preview = data_service.upload(file, user_id=session.get("user_id"))

        return jsonify({
            "status": "success",
            "data": {"dataset_id": dataset_ref.id, **preview}
        })
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"上传失败: {str(e)}"}), 500
