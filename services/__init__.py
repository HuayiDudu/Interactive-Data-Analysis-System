"""
services 包 - 业务逻辑层
===========================
【层】业务逻辑层（Service）
【说明】实现核心业务逻辑：数据管理、清洗、可视化、分析。
        所有 Service 通过构造函数注入 DataRepository 抽象实例，
        通过 DatasetRef 获取数据，完全消除对文件路径、Session 或请求上下文的依赖。
【负责人】项目负责人（通用组件/集成）
"""

from .auth_service import AuthService
from .data_service import DataService
from .clean_service import CleanService
from .visualize_service import VisualizeService
from .analyze_service import AnalyzeService

__all__ = [
    "AuthService",
    "DataService",
    "CleanService",
    "VisualizeService",
    "AnalyzeService",
]
