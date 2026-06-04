"""
routes/auth.py - 用户认证路由
===============================
【层】控制层（Flask 路由）
【说明】POST /api/register - 注册新用户
        POST /api/login    - 登录，写入 session
        POST /api/logout   - 登出，清除 session
        GET  /api/me       - 获取当前登录用户信息
【负责人】项目负责人
"""

from flask import Blueprint, current_app, jsonify, request, session

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/register", methods=["POST"])
def register():
    """
    注册新用户。

    请求体 JSON: { "username": "...", "password": "..." }
    成功: 201 + 用户信息
    失败: 400 + 错误信息
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "请求体不能为空"}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username:
        return jsonify({"status": "error", "message": "用户名不能为空"}), 400
    if not password:
        return jsonify({"status": "error", "message": "密码不能为空"}), 400

    try:
        auth_service = current_app.auth_service
        user = auth_service.register(username, password)
        return jsonify({"status": "success", "data": user}), 201
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@auth_bp.route("/api/login", methods=["POST"])
def login():
    """
    用户登录。

    请求体 JSON: { "username": "...", "password": "..." }
    成功后 session 中写入 user_id。
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "请求体不能为空"}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username:
        return jsonify({"status": "error", "message": "用户名不能为空"}), 400
    if not password:
        return jsonify({"status": "error", "message": "密码不能为空"}), 400

    try:
        auth_service = current_app.auth_service
        user = auth_service.login(username, password)
        session["user_id"] = user["id"]
        session.permanent = True
        return jsonify({"status": "success", "data": user})
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 401


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    """登出，清除当前 session。"""
    session.clear()
    return jsonify({"status": "success", "data": {"message": "已登出"}})


@auth_bp.route("/api/me", methods=["GET"])
def me():
    """
    获取当前登录用户信息。

    需要 session 中包含有效的 user_id。
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "未登录"}), 401

    auth_service = current_app.auth_service
    user = auth_service.get_user_by_id(user_id)
    if not user:
        session.clear()
        return jsonify({"status": "error", "message": "用户不存在"}), 401

    return jsonify({"status": "success", "data": user})
