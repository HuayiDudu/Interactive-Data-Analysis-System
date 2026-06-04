"""
services/auth_service.py - 用户认证业务逻辑
==============================================
【层】业务逻辑层（Service）
【说明】用户注册和登录的核心业务逻辑，使用 werkzeug 进行密码哈希验证。
        严格遵循层规：不依赖 Flask request/session，不操作文件系统。
【负责人】项目负责人
"""

import sqlite3

from werkzeug.security import check_password_hash, generate_password_hash

from repositories.sqlite_repo import SQLiteRepository


class AuthService:
    """
    用户认证服务。

    处理用户注册、登录和身份查询的核心业务逻辑。
    通过 SQLiteRepository 进行用户数据持久化。
    """

    def __init__(self, repo: SQLiteRepository):
        self._repo = repo

    def register(self, username: str, password: str) -> dict:
        """
        注册新用户。

        Args:
            username: 用户名（非空，1-50 字符）。
            password: 密码（非空，最少 6 字符）。

        Returns:
            用户信息字典（不含 password 字段）。

        Raises:
            ValueError: 用户名/密码不符合要求，或用户名已被注册。
        """
        username = username.strip()
        if not username:
            raise ValueError("用户名不能为空")
        if len(username) > 50:
            raise ValueError("用户名不能超过 50 个字符")
        if not password:
            raise ValueError("密码不能为空")
        if len(password) < 6:
            raise ValueError("密码长度不能少于 6 个字符")

        password_hash = generate_password_hash(password)

        try:
            user_id = self._repo.create_user(username, password_hash)
        except sqlite3.IntegrityError:
            raise ValueError(f"用户名 '{username}' 已被注册")

        return {
            "id": user_id,
            "username": username,
            "created_at": None,  # 可由前端重新查询获取
        }

    def login(self, username: str, password: str) -> dict:
        """
        用户登录验证。

        Args:
            username: 用户名。
            password: 明文密码。

        Returns:
            用户信息字典（不含 password 字段）。

        Raises:
            ValueError: 用户名或密码错误。
        """
        user = self._repo.get_user_by_username(username.strip())
        if not user:
            raise ValueError("用户名或密码错误")

        if not check_password_hash(user["password"], password):
            raise ValueError("用户名或密码错误")

        return {
            "id": user["id"],
            "username": user["username"],
            "created_at": user["created_at"],
        }

    def get_user_by_id(self, user_id: int) -> dict | None:
        """
        根据用户 ID 获取用户信息（不含密码）。

        Returns:
            用户信息字典，或 None（用户不存在）。
        """
        user = self._repo.get_user_by_id(user_id)
        if not user:
            return None
        return {
            "id": user["id"],
            "username": user["username"],
            "created_at": user["created_at"],
        }
