import functools
from flask import Blueprint, request, jsonify
from services.analyze_service import (
    run_kmeans,
    run_dbscan,
    run_linear_regression,
    run_polynomial_regression,
    compare_clustering,
    compare_regression,
)
from repositories import get_repo

analyze_bp = Blueprint("analyze", __name__, url_prefix="/analyze")


# ─────────────────────────────────────────────
#  工具函数
# ─────────────────────────────────────────────

def _load_df(dataset_id: str):
    """通过 repository 加载 DataFrame，若无则报错"""
    repo = get_repo()
    df = repo.load(dataset_id)
    if df is None:
        raise FileNotFoundError(f"找不到数据集：{dataset_id}")
    return df


def _validate_body(body: dict, required_keys: list):
    """
    检查请求体中必填字段是否存在且非空。
    缺失时抛出 KeyError，由装饰器统一捕获并返回 400。
    """
    if body is None:
        raise KeyError("请求体为空或不是合法 JSON")
    for key in required_keys:
        if key not in body or body[key] is None or body[key] == "":
            raise KeyError(f"缺少必填字段：{key}")


def _parse_int(value, name: str, default: int) -> int:
    """
    安全解析整数参数。
    转换失败时抛出 TypeError（400），而非 ValueError（422），
    语义更准确（格式错误，而非值不合法）。
    """
    try:
        return int(value)
    except (TypeError, ValueError):
        raise TypeError(f"{name} 必须是整数，收到：{value!r}")


def _parse_float(value, name: str, default: float) -> float:
    """
    安全解析浮点参数，转换失败抛 TypeError（400）。
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        raise TypeError(f"{name} 必须是数字，收到：{value!r}")


def _ok(data: dict):
    """统一成功响应"""
    return jsonify({"status": "ok", "data": data})


def _err(message: str, code: int):
    """统一错误响应"""
    return jsonify({"status": "error", "message": message}), code


def handle_errors(func):
    """
    路由异常处理装饰器。
    将每个路由中重复的 try/except 块集中到这里，
    路由函数本身只需关注业务逻辑。

    异常映射：
      KeyError / TypeError  →  400  参数缺失或格式错误
      ValueError            →  422  参数值不合法（由 service 层抛出）
      FileNotFoundError     →  404  数据集不存在
      其他 Exception        →  500  服务器内部错误
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except (KeyError, TypeError) as e:
            return _err(f"参数缺失或格式错误：{e}", 400)
        except ValueError as e:
            return _err(str(e), 422)
        except FileNotFoundError as e:
            return _err(str(e), 404)
        except Exception as e:
            return _err(f"服务器内部错误：{e}", 500)
    return wrapper


# ─────────────────────────────────────────────
#  聚类路由
# ─────────────────────────────────────────────

@analyze_bp.route("/kmeans", methods=["POST"])
@handle_errors
def kmeans():
    """
    K-Means 聚类
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "columns": ["col1", "col2"],
      "n_clusters": 3          ← 可选，默认 3，范围 2~10
    }
    返回字段：silhouette_score、davies_bouldin_score、skipped_cols（被跳过的非数值列）
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "columns"])

    # FIX: 用 _parse_int 替代裸 int()，格式错误时返回 400 而非 422
    n_clusters = _parse_int(body.get("n_clusters", 3), "n_clusters", 3)

    df = _load_df(body["dataset_id"])
    result = run_kmeans(
        df,
        columns=body["columns"],
        n_clusters=n_clusters,
    )
    return _ok(result)


@analyze_bp.route("/dbscan", methods=["POST"])
@handle_errors
def dbscan():
    """
    DBSCAN 密度聚类
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "columns": ["col1", "col2"],
      "eps": 0.5,              ← 可选，默认 0.5（针对标准化后数据）
      "min_samples": 5         ← 可选，默认 5
    }
    label=-1 的点为噪声点；返回 skipped_cols 告知跳过的非数值列
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "columns"])

    # FIX: 用安全解析函数，格式错误时返回 400
    eps         = _parse_float(body.get("eps", 0.5),         "eps",         0.5)
    min_samples = _parse_int(body.get("min_samples", 5),     "min_samples", 5)

    df = _load_df(body["dataset_id"])
    result = run_dbscan(
        df,
        columns=body["columns"],
        eps=eps,
        min_samples=min_samples,
    )
    return _ok(result)


@analyze_bp.route("/compare/clustering", methods=["POST"])
@handle_errors
def compare_clustering_route():
    """
    聚类多算法对比：K-Means vs DBSCAN
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "columns": ["col1", "col2"],
      "n_clusters": 3,         ← K-Means 参数，可选，默认 3
      "eps": 0.5,              ← DBSCAN 参数，可选，默认 0.5
      "min_samples": 5         ← DBSCAN 参数，可选，默认 5
    }
    返回 summary 列表可直接渲染为对比表格
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "columns"])

    # FIX: 用安全解析函数
    n_clusters  = _parse_int(body.get("n_clusters", 3),      "n_clusters",  3)
    eps         = _parse_float(body.get("eps", 0.5),         "eps",         0.5)
    min_samples = _parse_int(body.get("min_samples", 5),     "min_samples", 5)

    df = _load_df(body["dataset_id"])
    result = compare_clustering(
        df,
        columns=body["columns"],
        n_clusters=n_clusters,
        eps=eps,
        min_samples=min_samples,
    )
    return _ok(result)


# ─────────────────────────────────────────────
#  回归路由
# ─────────────────────────────────────────────

@analyze_bp.route("/regression", methods=["POST"])
@handle_errors
def regression():
    """
    线性回归（支持多特征列）
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "x_cols": ["age", "experience"],   ← 列表（单特征时传 ["age"] 即可）
      "y_col": "salary"
    }
    返回字段：coefficients（系数列表）、r_squared（拟合优度）、mae、rmse
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "x_cols", "y_col"])

    x_cols = body["x_cols"]
    if not isinstance(x_cols, list) or len(x_cols) == 0:
        raise TypeError("x_cols 必须是非空列表")

    df = _load_df(body["dataset_id"])
    result = run_linear_regression(df, x_cols, body["y_col"])
    return _ok(result)


@analyze_bp.route("/poly_regression", methods=["POST"])
@handle_errors
def poly_regression():
    """
    多项式回归（单特征）
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "x_col": "age",
      "y_col": "salary",
      "degree": 2              ← 可选，默认 2，范围 2~5
    }
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "x_col", "y_col"])

    # FIX: 用安全解析函数
    degree = _parse_int(body.get("degree", 2), "degree", 2)

    df = _load_df(body["dataset_id"])
    result = run_polynomial_regression(
        df,
        x_col=body["x_col"],
        y_col=body["y_col"],
        degree=degree,
    )
    return _ok(result)


@analyze_bp.route("/compare/regression", methods=["POST"])
@handle_errors
def compare_regression_route():
    """
    回归多算法对比：线性回归 / Ridge / Lasso / 多项式回归
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "x_cols": ["age"],
      "y_col": "salary",
      "degree": 2              ← 多项式回归阶数，可选，默认 2
    }
    返回 summary 列表已按 R² 标注最优算法（"最优": "✓"）
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "x_cols", "y_col"])

    x_cols = body["x_cols"]
    if not isinstance(x_cols, list) or len(x_cols) == 0:
        raise TypeError("x_cols 必须是非空列表")

    # FIX: 用安全解析函数
    degree = _parse_int(body.get("degree", 2), "degree", 2)

    df = _load_df(body["dataset_id"])
    result = compare_regression(
        df,
        x_cols=x_cols,
        y_col=body["y_col"],
        degree=degree,
    )
    return _ok(result)