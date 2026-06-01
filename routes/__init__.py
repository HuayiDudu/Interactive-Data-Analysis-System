"""
routes 包 - 控制层（Flask 路由）
==================================
【层】控制层（Flask 路由）
【说明】接收 HTTP 请求，调用 Service 层方法，统一 JSON 响应。
        严格遵循层间依赖规则：
        - 仅可调用 Service 层的实例方法
        - 可使用 Flask 的 request, session 对象获取请求数据（但不能将其传入 Service 层）
        - 数据集状态必须通过 DatasetRef 在请求间显式传递
        - 禁止直接操作 session、文件系统、pandas、数据访问层
【负责人】项目负责人（通用组件/集成）
"""

from flask import Blueprint

# ================================================================
# 注册所有路由蓝图
# ================================================================
# 【说明】每个路由模块按功能拆分为独立的 Blueprint，在 app 工厂中注册。
#        各 Blueprint 的 url_prefix 在 create_app 中统一设置。

from .upload import upload_bp
from .clean import clean_bp
from .plot import plot_bp
from .analyze import analyze_bp
from .export import export_bp


def register_blueprints(app):
    """在 Flask 应用实例上注册所有蓝图。"""
    app.register_blueprint(upload_bp)
    app.register_blueprint(clean_bp)
    app.register_blueprint(plot_bp)
    app.register_blueprint(analyze_bp)
    app.register_blueprint(export_bp)

    # 扩展阶段取消注释
    # from .auth import auth_bp
    # from .history import history_bp
    # app.register_blueprint(auth_bp)
    # app.register_blueprint(history_bp)


__all__ = ["register_blueprints"]
