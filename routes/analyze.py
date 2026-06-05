"""
routes/analyze.py - 数据分析路由
==================================
【层】控制层（Flask 路由）
【说明】提供数据分析 HTTP API：聚类、回归、算法对比。
        严格遵循层间依赖规则：仅调用 Service 层方法，不直接操作数据访问层。
        兼容两套路由：
        (1) POST /analyze            — 统一分发路由，algorithm 字段指定算法
        (2) POST /analyze/kmeans 等  — 按算法独立路由
【负责人】分析功能模块开发人员
"""

import functools

from flask import Blueprint, current_app, jsonify, request

from value_objects import DatasetRef

analyze_bp = Blueprint("analyze", __name__)


# ─────────────────────────────────────────────
#  工具函数
# ─────────────────────────────────────────────

def _validate_body(body: dict, required_keys: list):
    """检查请求体中必填字段是否存在且非空。"""
    if body is None:
        raise KeyError("请求体为空或不是合法 JSON")
    for key in required_keys:
        if key not in body or body[key] is None or body[key] == "":
            raise KeyError(f"缺少必填字段：{key}")


def _parse_int(value, name: str, default: int) -> int:
    """安全解析整数参数，格式错误时抛 TypeError。"""
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        raise TypeError(f"{name} 必须是整数，收到：{value!r}")


def _parse_float(value, name: str, default: float) -> float:
    """安全解析浮点参数，格式错误时抛 TypeError。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        raise TypeError(f"{name} 必须是数字，收到：{value!r}")


def _ok(data: dict):
    """统一成功响应。"""
    return jsonify({"status": "success", "data": data})


def handle_errors(func):
    """
    路由异常处理装饰器。

    异常映射：
      KeyError / TypeError  →  400
      ValueError            →  422
      FileNotFoundError     →  404
      其他 Exception        →  500
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except (KeyError, TypeError) as e:
            return jsonify({"status": "error", "message": f"参数缺失或格式错误：{e}"}), 400
        except ValueError as e:
            return jsonify({"status": "error", "message": str(e)}), 422
        except FileNotFoundError as e:
            return jsonify({"status": "error", "message": str(e)}), 404
        except Exception as e:
            return jsonify({"status": "error", "message": f"服务器内部错误：{e}"}), 500
    return wrapper


# ─────────────────────────────────────────────
#  统一分发路由（开发文档 4.4 接口契约）
# ─────────────────────────────────────────────

@analyze_bp.route("/analyze", methods=["POST"])
@handle_errors
def analyze_dispatch():
    """
    数据分析统一入口路由。

    请求体 JSON 示例（K-Means）:
    {
        "dataset_id": "xxx",
        "algorithm": "kmeans",
        "columns": ["col1", "col2"],
        "n_clusters": 3
    }

    请求体 JSON 示例（线性回归）:
    {
        "dataset_id": "xxx",
        "algorithm": "linear_regression",
        "feature_cols": ["age", "income"],
        "target_col": "score"
    }

    algorithm 支持的取值:
        kmeans, dbscan, linear_regression,
        polynomial_regression, compare_clustering, compare_regression
    """
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "algorithm"])

    dataset_ref = DatasetRef(body["dataset_id"])
    algorithm = body.pop("algorithm")

    service = current_app.analyze_service
    result = service.analyze(dataset_ref, algorithm, body)
    return _ok(result)


# ─────────────────────────────────────────────
#  聚类路由（按算法独立路由）
# ─────────────────────────────────────────────

@analyze_bp.route("/analyze/kmeans", methods=["POST"])
@handle_errors
def kmeans():
    """K-Means 聚类。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id"])

    n_clusters = _parse_int(body.get("n_clusters", 3), "n_clusters", 3)
    service = current_app.analyze_service
    result = service.kmeans(
        DatasetRef(body["dataset_id"]),
        columns=body.get("columns"),
        n_clusters=n_clusters,
    )
    return _ok(result)


@analyze_bp.route("/analyze/dbscan", methods=["POST"])
@handle_errors
def dbscan():
    """DBSCAN 密度聚类。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id"])

    eps = _parse_float(body.get("eps", 0.5), "eps", 0.5)
    min_samples = _parse_int(body.get("min_samples", 5), "min_samples", 5)
    service = current_app.analyze_service
    result = service.dbscan(
        DatasetRef(body["dataset_id"]),
        columns=body.get("columns"),
        eps=eps,
        min_samples=min_samples,
    )
    return _ok(result)


@analyze_bp.route("/analyze/compare/clustering", methods=["POST"])
@handle_errors
def compare_clustering():
    """聚类算法对比：K-Means vs DBSCAN。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id"])

    n_clusters = _parse_int(body.get("n_clusters", 3), "n_clusters", 3)
    eps = _parse_float(body.get("eps", 0.5), "eps", 0.5)
    min_samples = _parse_int(body.get("min_samples", 5), "min_samples", 5)
    service = current_app.analyze_service
    result = service.compare_clustering(
        DatasetRef(body["dataset_id"]),
        columns=body.get("columns"),
        n_clusters=n_clusters,
        eps=eps,
        min_samples=min_samples,
    )
    return _ok(result)


# ─────────────────────────────────────────────
#  回归路由
# ─────────────────────────────────────────────

@analyze_bp.route("/analyze/regression", methods=["POST"])
@handle_errors
def regression():
    """线性回归（支持多特征列）。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "feature_cols", "target_col"])

    feature_cols = body["feature_cols"]
    if not isinstance(feature_cols, list) or len(feature_cols) == 0:
        raise TypeError("feature_cols 必须是非空列表")

    service = current_app.analyze_service
    result = service.linear_regression(
        DatasetRef(body["dataset_id"]),
        feature_cols=feature_cols,
        target_col=body["target_col"],
    )
    return _ok(result)


@analyze_bp.route("/analyze/poly_regression", methods=["POST"])
@handle_errors
def poly_regression():
    """多项式回归（单特征）。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "feature_col", "target_col"])

    degree = _parse_int(body.get("degree", 2), "degree", 2)
    service = current_app.analyze_service
    result = service.polynomial_regression(
        DatasetRef(body["dataset_id"]),
        feature_col=body["feature_col"],
        target_col=body["target_col"],
        degree=degree,
    )
    return _ok(result)


@analyze_bp.route("/analyze/compare/regression", methods=["POST"])
@handle_errors
def compare_regression():
    """回归算法对比：线性 / Ridge / Lasso / 多项式。"""
    body = request.get_json(force=True)
    _validate_body(body, ["dataset_id", "feature_cols", "target_col"])

    feature_cols = body["feature_cols"]
    if not isinstance(feature_cols, list) or len(feature_cols) == 0:
        raise TypeError("feature_cols 必须是非空列表")

    degree = _parse_int(body.get("degree", 2), "degree", 2)
    service = current_app.analyze_service
    result = service.compare_regression(
        DatasetRef(body["dataset_id"]),
        feature_cols=feature_cols,
        target_col=body["target_col"],
        degree=degree,
    )
    return _ok(result)
