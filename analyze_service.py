import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import (
    r2_score,
    mean_absolute_error,
    mean_squared_error,
    silhouette_score,
    davies_bouldin_score,
)


# ─────────────────────────────────────────────
#  聚类模块
# ─────────────────────────────────────────────

def run_kmeans(df: pd.DataFrame, columns: list, n_clusters: int) -> dict:
    """
    K-Means 聚类（含 Silhouette Score、Davies-Bouldin Score 效果评估）

    自动过滤非数值列，非数值列记录在 skipped_cols 中返回。
    K 值范围限制为 2~10。

    :param df: 数据集 DataFrame
    :param columns: 参与聚类的列名列表
    :param n_clusters: 聚类数量 K
    :return: 聚类结果 + 评估指标字典
    """
    if len(columns) < 1:
        raise ValueError("至少需要选择一列")
    if not (2 <= n_clusters <= 10):
        raise ValueError("K 值应在 2~10 之间")

    # 自动过滤非数值列
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    skipped_cols = [c for c in columns if c not in numeric_cols]
    if not numeric_cols:
        raise ValueError("所选列中不含任何数值列，无法聚类")

    data = df[numeric_cols].dropna()
    if len(data) < n_clusters:
        raise ValueError("数据行数不能少于 K 值")

    model = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
    labels = model.fit_predict(data)

    sil_score = None
    db_score = None
    if len(set(labels)) > 1:
        sil_score = round(float(silhouette_score(data, labels)), 4)
        db_score = round(float(davies_bouldin_score(data, labels)), 4)

    return {
        "labels": labels.tolist(),
        "centers": model.cluster_centers_.tolist(),
        "n_clusters": n_clusters,
        "columns": numeric_cols,
        "skipped_cols": skipped_cols,
        "data": data.values.tolist(),
        "inertia": round(float(model.inertia_), 4),
        "silhouette_score": sil_score,
        "davies_bouldin_score": db_score,
    }


def run_dbscan(
    df: pd.DataFrame,
    columns: list,
    eps: float = 0.5,
    min_samples: int = 5,
) -> dict:
    """
    DBSCAN 密度聚类（含自动标准化，适合不规则形状簇）

    自动过滤非数值列，非数值列记录在 skipped_cols 中返回。

    :param eps: 邻域搜索半径（针对标准化后数据）
    :param min_samples: 核心点所需最少邻居数
    :return: 聚类结果 + 评估指标字典，label=-1 表示噪声点
    """
    if len(columns) < 1:
        raise ValueError("至少需要选择一列")
    if eps <= 0:
        raise ValueError("eps 必须大于 0")
    if min_samples < 1:
        raise ValueError("min_samples 至少为 1")

    # 自动过滤非数值列
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    skipped_cols = [c for c in columns if c not in numeric_cols]
    if not numeric_cols:
        raise ValueError("所选列中不含任何数值列，无法聚类")

    data = df[numeric_cols].dropna()
    if len(data) < min_samples:
        raise ValueError(f"有效数据行数（{len(data)}）不足 min_samples（{min_samples}）")

    # 标准化：消除量纲差异，让距离度量更合理
    scaler = StandardScaler()
    data_scaled = scaler.fit_transform(data)

    model = DBSCAN(eps=eps, min_samples=min_samples)
    labels = model.fit_predict(data_scaled)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = int(np.sum(labels == -1))

    # 仅对非噪声点计算评估指标
    sil_score = None
    db_score = None
    if n_clusters > 1:
        mask = labels != -1
        if mask.sum() > 1:
            sil_score = round(float(silhouette_score(data_scaled[mask], labels[mask])), 4)
            db_score = round(float(davies_bouldin_score(data_scaled[mask], labels[mask])), 4)

    return {
        "labels": labels.tolist(),
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "columns": numeric_cols,
        "skipped_cols": skipped_cols,
        "data": data.values.tolist(),
        "silhouette_score": sil_score,
        "davies_bouldin_score": db_score,
        "eps": eps,
        "min_samples": min_samples,
    }


def compare_clustering(
    df: pd.DataFrame,
    columns: list,
    n_clusters: int = 3,
    eps: float = 0.5,
    min_samples: int = 5,
) -> dict:
    """
    聚类多算法对比：K-Means vs DBSCAN

    两个算法独立运行，失败时记录错误但不中断对方，
    最终返回统一的 summary 对比表便于前端渲染。
    """
    results = {}
    errors = {}

    try:
        results["kmeans"] = run_kmeans(df, columns, n_clusters)
    except Exception as e:
        errors["kmeans"] = str(e)

    try:
        results["dbscan"] = run_dbscan(df, columns, eps, min_samples)
    except Exception as e:
        errors["dbscan"] = str(e)

    if not results:
        raise ValueError("所有聚类算法均运行失败：" + str(errors))

    # 构建统一对比摘要（前端直接渲染成表格）
    summary = []
    algo_display = {
        "kmeans": {
            "算法": "K-Means",
            "发现簇数": results.get("kmeans", {}).get("n_clusters", "—"),
            "噪声点数": "—",
            "轮廓系数 ↑": results.get("kmeans", {}).get("silhouette_score", "—"),
            "DB 指数 ↓": results.get("kmeans", {}).get("davies_bouldin_score", "—"),
            "Inertia ↓": results.get("kmeans", {}).get("inertia", "—"),
        },
        "dbscan": {
            "算法": "DBSCAN",
            "发现簇数": results.get("dbscan", {}).get("n_clusters", "—"),
            "噪声点数": results.get("dbscan", {}).get("n_noise", "—"),
            "轮廓系数 ↑": results.get("dbscan", {}).get("silhouette_score", "—"),
            "DB 指数 ↓": results.get("dbscan", {}).get("davies_bouldin_score", "—"),
            "Inertia ↓": "—",
        },
    }
    for algo_key, row in algo_display.items():
        if algo_key not in errors:
            summary.append(row)

    return {
        "results": results,
        "summary": summary,
        "errors": errors,
    }


# ─────────────────────────────────────────────
#  回归模块
# ─────────────────────────────────────────────

def run_linear_regression(df: pd.DataFrame, x_cols: list, y_col: str) -> dict:
    """
    线性回归（支持多特征列，含 MAE、RMSE 误差指标）

    返回字段含 coefficients（系数列表）和 r_squared。

    :param x_cols: 自变量列名列表（支持多列）
    :param y_col:  因变量列名
    """
    if not x_cols:
        raise ValueError("至少需要选择一个 X 列")

    data = df[x_cols + [y_col]].dropna()
    if len(data) < 2:
        raise ValueError("有效数据行数不足，无法回归")

    X = data[x_cols].values
    y = data[y_col].values

    model = LinearRegression()
    model.fit(X, y)
    y_pred = model.predict(X)

    coefficients = [round(float(c), 6) for c in model.coef_]
    intercept = round(float(model.intercept_), 6)
    r2 = round(float(r2_score(y, y_pred)), 6)
    mae = round(float(mean_absolute_error(y, y_pred)), 6)
    rmse = round(float(np.sqrt(mean_squared_error(y, y_pred))), 6)

    return {
        "coefficients": coefficients,
        "intercept": intercept,
        "r_squared": r2,
        "r2_score": r2,                             # 兼容旧字段名
        "slope": coefficients[0] if len(coefficients) == 1 else None,
        "mae": mae,
        "rmse": rmse,
        "x_values": data[x_cols[0]].tolist() if len(x_cols) == 1 else None,
        "y_values": data[y_col].tolist(),
        "y_predicted": [round(v, 4) for v in y_pred.tolist()],
        "x_cols": x_cols,
        "x_col": x_cols[0] if len(x_cols) == 1 else None,   # 兼容旧字段名
        "y_col": y_col,
    }


def run_polynomial_regression(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    degree: int = 2,
) -> dict:
    """
    多项式回归（单特征，支持 2~5 阶），通过 sklearn Pipeline 实现。

    include_bias=False 避免 PolynomialFeatures 插入的常数列与
    LinearRegression 自带的 intercept_ 重叠。
    coef_[i] 精确对应 x^(i+1) 项，intercept_ 是真正的截距。

    :param degree: 多项式阶数（2~5）
    """
    if not (2 <= degree <= 5):
        raise ValueError("多项式阶数应在 2~5 之间")

    data = df[[x_col, y_col]].dropna()
    if len(data) < degree + 1:
        raise ValueError(f"有效数据行数（{len(data)}）不足以拟合 {degree} 阶多项式")

    X = data[[x_col]].values
    y = data[y_col].values

    model = make_pipeline(
        PolynomialFeatures(degree=degree, include_bias=False),
        LinearRegression(),
    )
    model.fit(X, y)
    y_pred = model.predict(X)

    lr_step = model.named_steps["linearregression"]
    coefficients = [round(float(c), 6) for c in lr_step.coef_]
    intercept = round(float(lr_step.intercept_), 6)
    r2 = round(float(r2_score(y, y_pred)), 6)

    return {
        "degree": degree,
        "coefficients": coefficients,   # coefficients[i] 对应 x^(i+1) 项
        "intercept": intercept,
        "r2_score": r2,
        "r_squared": r2,
        "mae": round(float(mean_absolute_error(y, y_pred)), 6),
        "rmse": round(float(np.sqrt(mean_squared_error(y, y_pred))), 6),
        "x_values": data[x_col].tolist(),
        "y_values": data[y_col].tolist(),
        "y_predicted": [round(v, 4) for v in y_pred.tolist()],
        "x_col": x_col,
        "y_col": y_col,
    }


def compare_regression(
    df: pd.DataFrame,
    x_cols: list,
    y_col: str,
    degree: int = 2,
) -> dict:
    """
    回归多算法对比：线性回归 vs Ridge vs Lasso vs 多项式回归

    线性模型使用全部特征列，多项式回归使用 x_cols[0]（单变量展开）。

    :param x_cols: 自变量列名列表
    :param y_col:  因变量列名
    :param degree: 多项式回归阶数
    :return: 各算法结果 + 统一 summary 对比表 + 原始数据点
    """
    if not x_cols:
        raise ValueError("至少需要选择一个 X 列")

    data = df[x_cols + [y_col]].dropna()
    if len(data) < 4:
        raise ValueError("有效数据行数不足，无法进行算法对比")

    X = data[x_cols].values
    y = data[y_col].values

    # 线性算法组（使用全部 x_cols）
    linear_algos = {
        "线性回归":   LinearRegression(),
        "Ridge 回归": Ridge(alpha=1.0),
        "Lasso 回归": Lasso(alpha=0.1, max_iter=10000),
    }

    results = {}
    summary = []

    for name, algo in linear_algos.items():
        algo.fit(X, y)
        y_pred = algo.predict(X)
        r2   = round(float(r2_score(y, y_pred)), 6)
        mae  = round(float(mean_absolute_error(y, y_pred)), 6)
        rmse = round(float(np.sqrt(mean_squared_error(y, y_pred))), 6)
        results[name] = {
            "r2_score": r2,
            "r_squared": r2,
            "mae": mae,
            "rmse": rmse,
            "y_predicted": [round(v, 4) for v in y_pred.tolist()],
        }
        summary.append({"算法": name, "R² ↑": r2, "MAE ↓": mae, "RMSE ↓": rmse, "最优": ""})

    # 多项式回归单独处理：仅使用 x_cols[0]（单变量多项式展开）
    poly_x = x_cols[0]
    poly_name = f"多项式回归（{degree} 阶，基于 {poly_x}）"
    try:
        poly_result = run_polynomial_regression(data, poly_x, y_col, degree)
        results[poly_name] = poly_result
        summary.append({
            "算法": poly_name,
            "R² ↑": poly_result["r2_score"],
            "MAE ↓": poly_result["mae"],
            "RMSE ↓": poly_result["rmse"],
            "最优": "",
        })
    except Exception as e:
        # FIX: 多项式失败时在 summary 里补一行，让前端能看到失败原因
        results[poly_name] = {"error": str(e)}
        summary.append({
            "算法": poly_name,
            "R² ↑": "失败",
            "MAE ↓": "失败",
            "RMSE ↓": str(e),
            "最优": "",
        })

    # 按 R² 降序标注最优算法（仅对成功行参与排名）
    valid_rows = [row for row in summary if isinstance(row.get("R² ↑"), float)]
    if valid_rows:
        best_name = max(valid_rows, key=lambda r: r["R² ↑"])["算法"]
        for row in summary:
            row["最优"] = "✓" if row["算法"] == best_name else ""

    return {
        "results": results,
        "summary": summary,
        "x_values": data[x_cols[0]].tolist(),
        "y_values": data[y_col].tolist(),
        "x_cols": x_cols,
        "x_col": x_cols[0],
        "y_col": y_col,
    }