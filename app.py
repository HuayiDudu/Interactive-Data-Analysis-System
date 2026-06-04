"""
app.py - Flask 应用工厂
=========================
【层】控制层（Flask 路由）
【说明】应用工厂函数，组装并返回 Flask 应用实例。
        在此完成依赖注入：创建 Repository 实例并注入到各 Service 中。
【负责人】项目负责人（通用组件/集成）
"""

from flask import Flask, render_template

from config import DATABASE_PATH, MAX_CONTENT_LENGTH, SECRET_KEY, UPLOAD_FOLDER


def create_app() -> Flask:
    """
    创建并配置 Flask 应用实例。

    应用组装流程:
        1. 创建 Flask 实例
        2. 加载配置
        3. 初始化各层依赖（Repository -> Service）
        4. 注册路由蓝图
        5. 注册错误处理器
        6. 返回 app
    """
    app = Flask(__name__)

    # ================================================================
    # 1. 加载配置
    # ================================================================
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.config["DATABASE_PATH"] = DATABASE_PATH

    # ================================================================
    # 2. 依赖注入：创建 Repository 和 Service 实例
    # 【负责人：】项目负责人（通用组件/集成）
    # ================================================================
    from repositories import SQLiteRepository
    from services import DataService, CleanService, VisualizeService, AnalyzeService

    repo = SQLiteRepository(app.config["DATABASE_PATH"])
    app.data_service = DataService(repo)
    app.clean_service = CleanService(repo)
    app.visualize_service = VisualizeService(repo)
    app.analyze_service = AnalyzeService(repo)

    # ================================================================
    # 3. 注册路由蓝图
    # ================================================================
    from routes import register_blueprints

    register_blueprints(app)

    # ================================================================
    # 4. 注册根路由（提供前端页面）
    # 【负责人：】Web界面模块开发人员
    # ================================================================
    @app.route("/")
    def index():
        return render_template("login.html")

    @app.route("/app")
    def dashboard():
        return render_template("index.html")

    # ================================================================
    # 5. 注册错误处理器
    # ================================================================
    @app.errorhandler(400)
    def bad_request(error):
        return {"status": "error", "message": str(error)}, 400

    @app.errorhandler(404)
    def not_found(error):
        return {"status": "error", "message": "请求的资源不存在"}, 404

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return {"status": "error", "message": "上传文件超过大小限制"}, 413

    @app.errorhandler(500)
    def internal_error(error):
        return {"status": "error", "message": "服务器内部错误"}, 500

    return app


# ================================================================
# 入口点
# ================================================================
if __name__ == "__main__":
    app = create_app()
    # 【待实现】调试模式下可配置 host, port, debug 等参数
    app.run(host="0.0.0.0", port=5000, debug=True)
