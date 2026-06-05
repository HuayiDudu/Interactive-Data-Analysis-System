"""
config.py - 全局配置文件
=================================
【层】核心架构抽象（贯穿各层的通用组件）
【说明】统一管理所有配置项，各层通过导入此模块获取配置，避免硬编码。
【负责人】项目负责人（通用组件）
"""

import os

# ============================================================
# 基础路径配置
# ============================================================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# ============================================================
# 文件上传相关配置
# ============================================================
UPLOAD_FOLDER = os.environ.get(
    "UPLOAD_FOLDER",
    os.path.join(BASE_DIR, "uploads"),
)
"""文件上传存储目录（MVP阶段使用临时CSV文件存放于此）"""

MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
"""上传文件大小上限，默认 16MB"""

ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx"}
"""允许上传的文件扩展名集合"""

# ============================================================
# Flask 应用配置
# ============================================================
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
"""Flask secret key，生产环境必须替换"""

# ============================================================
# 数据库配置（扩展阶段使用）
# ============================================================
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(BASE_DIR, "repositories", "analysis.db"),
)
"""SQLite 数据库文件路径，扩展阶段启用SQLite时使用"""

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///repositories/analysis.db")
"""数据库连接URL，SQLAlchemy 方式连接时使用"""

# ============================================================
# 分页默认参数（扩展阶段使用）
# ============================================================
DEFAULT_PAGE = 1
DEFAULT_PER_PAGE = 10
MAX_PER_PAGE = 50
"""分页查询默认参数范围"""
