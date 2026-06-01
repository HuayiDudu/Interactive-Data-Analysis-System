"""
routes/upload.py - 文件上传路由
=================================
【层】控制层（Flask 路由）
【说明】POST /upload - 接收上传的 CSV/Excel 文件，调用业务层解析并保存。
【负责人】数据管理模块开发人员
"""

from flask import Blueprint, jsonify, request

from services.data_service import DataService
from value_objects import DatasetRef

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

    【待实现：数据管理模块】
    - 验证请求中是否包含文件
    - 验证文件扩展名是否在允许范围内
    - 获取 DataService 实例（通过 current_app 或依赖注入）
    - 调用 data_service.upload(file) 获取结果
    - 构造统一 JSON 响应
    - 异常捕获并返回友好的错误信息
    """
    # ================================================================
    # 【待实现：数据管理模块】
    # 1. 检查 request.files 中是否有文件 -> 若没有返回 400
    # 2. 检查文件扩展名是否合法
    # 3. 通过 current_app.data_service 获取 DataService 实例并调用 upload()
    # 4. 捕获 ValueError/Exception，返回 {"status": "error", "message": "..."}
    # 5. 返回 JSON 响应
    # ================================================================
    raise NotImplementedError("数据管理模块开发人员需实现 upload 路由")
