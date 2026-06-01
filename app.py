"""
app.py - Flask 应用工厂
=========================
【层】控制层（Flask 路由）
【说明】应用工厂函数，组装并返回 Flask 应用实例。
        在此完成依赖注入：创建 Repository 实例并注入到各 Service 中。
【负责人】项目负责人（通用组件/集成）
"""

from flask import Flask

from config import MAX_CONTENT_LENGTH, SECRET_KEY, UPLOAD_FOLDER


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

    【待实现】
    - 完善依赖注入链:
        repo = FileRepository()
        data_service = DataService(repo)
        clean_service = CleanService(repo)
        visualize_service = VisualizeService(repo)
        analyze_service = AnalyzeService(repo)
    - 将 Service 实例挂载到 app 上以便路由函数访问:
        app.data_service = data_service
        app.clean_service = clean_service
        app.visualize_service = visualize_service
        app.analyze_service = analyze_service
    - 注册统一错误处理器，将未捕获异常转换为 { "status": "error", "message": "..." } 格式
    """
    app = Flask(__name__)

    # ================================================================
    # 1. 加载配置
    # ================================================================
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

    # ================================================================
    # 2. 依赖注入：创建 Repository 和 Service 实例
    # 【负责人：】项目负责人（通用组件/集成）
    # ================================================================
    # ---------- 待实现：创建各层实例并注入依赖 ----------
    # from repositories import FileRepository
    # from services import DataService, CleanService, VisualizeService, AnalyzeService
    #
    # repo = FileRepository()
    # app.data_service = DataService(repo)
    # app.clean_service = CleanService(repo)
    # app.visualize_service = VisualizeService(repo)
    # app.analyze_service = AnalyzeService(repo)

    # 各模块路由通过 current_app.data_service / current_app.clean_service 等访问 Service

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
        """返回主页面。"""
        # ---------- Web界面模块待实现：返回 index.html 或重定向 ----------
        return "交互式数据分析系统 - MVP"

    # ================================================================
    # 5. 注册错误处理器
    # ================================================================
    # ---------- 待实现：全局错误处理 ----------
    @app.errorhandler(400)
    def bad_request(error):
        return {"status": "error", "message": str(error)}, 400

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
