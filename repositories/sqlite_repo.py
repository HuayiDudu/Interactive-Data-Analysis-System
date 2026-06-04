"""
repositories/sqlite_repo.py - SQLite 数据仓库（扩展阶段）
=========================================================
【层】数据访问层（Repository）
【说明】扩展阶段的数据仓库实现，使用 SQLite + Parquet 持久化存储。
        与 FileRepository 实现相同的 DataRepository 抽象接口，
        应用重启后数据集不会丢失。
【负责人】项目负责人
"""

import sqlite3
import uuid
from io import BytesIO

import pandas as pd

from repositories.base import DataRepository
from value_objects import DatasetRef


class SQLiteRepository(DataRepository):
    """
    SQLite + Parquet 数据仓库。

    内部使用 SQLite BLOB 列存储 Parquet 序列化的 DataFrame。
    Parquet 格式相比 pickle 更安全、跨平台，且保留数据类型和 NaN。

    线程安全策略:
        - connect(check_same_thread=False) 允许 Flask 多线程访问
        - PRAGMA journal_mode=WAL 读写不互斥
        - PRAGMA busy_timeout=5000 写入冲突时等待而非立即报错
    """

    def __init__(self, db_path: str):
        """
        初始化 SQLite 仓库。

        Args:
            db_path: SQLite 数据库文件路径（如 "analysis.db"）。
        """
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._init_db()

    def _init_db(self) -> None:
        """初始化数据库表结构。"""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id         TEXT    PRIMARY KEY,
                data       BLOB    NOT NULL,
                name       TEXT,
                created_at TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        """)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT    UNIQUE NOT NULL,
                password   TEXT    NOT NULL,
                created_at TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        """)
        self._conn.commit()

    def save_data(
        self, df: pd.DataFrame, context: dict | None = None
    ) -> DatasetRef:
        """
        保存 DataFrame 为 Parquet BLOB，返回 DatasetRef。

        Args:
            df: 要保存的 DataFrame。
            context: 可选上下文，支持:
                - "filename": 原始文件名，存入 name 列。

        Returns:
            新生成的 DatasetRef。
        """
        ref = DatasetRef(uuid.uuid4().hex)
        name = (context or {}).get("filename", "")

        buf = BytesIO()
        df.to_parquet(buf, index=False)
        blob = buf.getvalue()

        self._conn.execute(
            "INSERT INTO datasets (id, data, name) VALUES (?, ?, ?)",
            (ref.id, blob, name),
        )
        self._conn.commit()
        return ref

    def load_data(self, ref: DatasetRef) -> pd.DataFrame:
        """
        从数据库加载 DataFrame。

        Args:
            ref: 数据集引用。

        Returns:
            对应的 pandas DataFrame。

        Raises:
            ValueError: 数据集不存在或已被删除。
        """
        row = self._conn.execute(
            "SELECT data FROM datasets WHERE id = ?", (ref.id,)
        ).fetchone()

        if not row:
            raise ValueError(f"数据集不存在或已被删除: {ref.id}")

        return pd.read_parquet(BytesIO(row[0]))

    def delete_data(self, ref: DatasetRef) -> None:
        """
        从数据库删除数据集。

        Args:
            ref: 要删除的数据集引用。
        """
        self._conn.execute(
            "DELETE FROM datasets WHERE id = ?", (ref.id,)
        )
        self._conn.commit()

    # ================================================================
    # 用户管理（扩展阶段 — 多用户登录）
    # ================================================================

    def create_user(self, username: str, password_hash: str) -> int:
        """
        创建新用户。

        Args:
            username: 用户名（唯一）。
            password_hash: werkzeug 密码哈希值。

        Returns:
            新用户的 id。

        Raises:
            sqlite3.IntegrityError: 用户名已存在。
        """
        cursor = self._conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, password_hash),
        )
        self._conn.commit()
        return cursor.lastrowid

    def get_user_by_username(self, username: str) -> dict | None:
        """
        根据用户名查询用户。

        Returns:
            用户字典 {id, username, password, created_at} 或 None。
        """
        row = self._conn.execute(
            "SELECT id, username, password, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "username": row[1],
            "password": row[2],
            "created_at": row[3],
        }

    def get_user_by_id(self, user_id: int) -> dict | None:
        """
        根据 ID 查询用户。

        Returns:
            用户字典 {id, username, password, created_at} 或 None。
        """
        row = self._conn.execute(
            "SELECT id, username, password, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "username": row[1],
            "password": row[2],
            "created_at": row[3],
        }
