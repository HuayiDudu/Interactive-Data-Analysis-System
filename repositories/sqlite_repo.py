"""
repositories/sqlite_repo.py - SQLite 数据仓库（扩展阶段）
=========================================================
【层】数据访问层（Repository）
【说明】扩展阶段的数据仓库实现，使用 SQLite + Parquet 持久化存储。
        与 FileRepository 实现相同的 DataRepository 抽象接口，
        应用重启后数据集不会丢失。
【负责人】项目负责人
"""

import atexit
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
        atexit.register(self._close_and_checkpoint)

    def _close_and_checkpoint(self) -> None:
        """程序退出时合并 WAL 日志并关闭连接。"""
        self._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        self._conn.close()

    def _init_db(self) -> None:
        """初始化数据库表结构。"""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id         TEXT    PRIMARY KEY,
                data       BLOB    NOT NULL,
                name       TEXT,
                user_id    INTEGER,
                created_at TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        """)
        # 迁移：为已有数据库添加 user_id 列（若尚不存在）
        try:
            self._conn.execute("ALTER TABLE datasets ADD COLUMN user_id INTEGER")
        except sqlite3.OperationalError:
            pass
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
                - "user_id": 上传用户的 ID，存入 user_id 列。

        Returns:
            新生成的 DatasetRef。
        """
        ref = DatasetRef(uuid.uuid4().hex)
        ctx = context or {}
        name = ctx.get("filename", "")
        user_id = ctx.get("user_id")

        buf = BytesIO()
        df.to_parquet(buf, index=False)
        blob = buf.getvalue()

        self._conn.execute(
            "INSERT INTO datasets (id, data, name, user_id) VALUES (?, ?, ?, ?)",
            (ref.id, blob, name, user_id),
        )
        self._conn.commit()
        return ref

    def load_data(
        self, ref: DatasetRef, user_id: int | None = None
    ) -> pd.DataFrame:
        """
        从数据库加载 DataFrame，可选所有权校验。

        Args:
            ref: 数据集引用。
            user_id: 若传入，检查数据集是否属于该用户。
                     允许 NULL user_id（迁移遗留数据）供任何用户读取。

        Returns:
            对应的 pandas DataFrame。

        Raises:
            ValueError: 数据集不存在、已被删除或无访问权限。
        """
        row = self._conn.execute(
            "SELECT data, user_id FROM datasets WHERE id = ?", (ref.id,)
        ).fetchone()

        if not row:
            raise ValueError(f"数据集不存在或已被删除: {ref.id}")

        owner_id = row[1]
        if user_id is not None and owner_id is not None and owner_id != user_id:
            raise ValueError(f"无权访问该数据集")

        return pd.read_parquet(BytesIO(row[0]))

    def list_datasets(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 10,
        search: str = "",
        order_by: str = "created_at",
        order_dir: str = "desc",
    ) -> dict:
        """
        分页列出指定用户的数据集列表。

        Args:
            user_id: 用户 ID。
            page: 页码，从 1 开始。
            per_page: 每页条数，范围 [5, 50]。
            search: 按文件名模糊检索。
            order_by: 排序字段，'created_at'（默认）或 'name'。
            order_dir: 排序方向，'asc' 或 'desc'，默认 'desc'。

        Returns:
            {"total": int, "page": int, "per_page": int, "items": [...]}
        """
        per_page = max(5, min(50, per_page))
        page = max(1, page)
        offset = (page - 1) * per_page

        if order_by not in ("created_at", "name"):
            order_by = "created_at"
        order_dir_sql = "ASC" if order_dir == "asc" else "DESC"

        if search:
            where = "WHERE user_id = ? AND name LIKE ?"
            params: list = [user_id, f"%{search}%"]
        else:
            where = "WHERE user_id = ?"
            params = [user_id]

        count_row = self._conn.execute(
            f"SELECT COUNT(*) FROM datasets {where}", params
        ).fetchone()
        total = count_row[0] if count_row else 0

        rows = self._conn.execute(
            f"SELECT id, name, created_at FROM datasets {where} ORDER BY {order_by} {order_dir_sql} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()

        items = [
            {"id": r[0], "name": r[1] or "", "created_at": r[2]}
            for r in rows
        ]
        return {"total": total, "page": page, "per_page": per_page, "items": items}

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
