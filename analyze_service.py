import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score


def run_kmeans(df: pd.DataFrame, columns: list, n_clusters: int) -> dict:
    """
    K-Means 聚类
    :param df: 数据集 DataFrame
    :param columns: 参与聚类的列名列表，例如 ["age", "salary"]
    :param n_clusters: 聚类数量 K
    :return: 包含标签和簇中心的字典
    """
    if len(columns) < 1:
        raise ValueError("至少需要选择一列")
    if n_clusters < 2:
        raise ValueError("K 值至少为 2")

    data = df[columns].dropna()
    if len(data) < n_clusters:
        raise ValueError("数据行数不能少于 K 值")

    model = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
    labels = model.fit_predict(data)

    return {
        "labels": labels.tolist(),                          # 每行对应的簇编号
        "centers": model.cluster_centers_.tolist(),         # 各簇中心坐标
        "n_clusters": n_clusters,
        "columns": columns,
        "data": data.values.tolist(),                       # 原始数据点（用于前端画图）
        "inertia": round(float(model.inertia_), 4),         # 误差平方和（越小越好）
    }


def run_linear_regression(df: pd.DataFrame, x_col: str, y_col: str) -> dict:
    """
    线性回归
    :param df: 数据集 DataFrame
    :param x_col: 自变量列名
    :param y_col: 因变量列名
    :return: 回归结果字典
    """
    data = df[[x_col, y_col]].dropna()
    if len(data) < 2:
        raise ValueError("有效数据行数不足，无法回归")

    X = data[[x_col]].values
    y = data[y_col].values

    model = LinearRegression()
    model.fit(X, y)
    y_pred = model.predict(X)

    return {
        "slope": round(float(model.coef_[0]), 6),           # 斜率
        "intercept": round(float(model.intercept_), 6),     # 截距
        "r2_score": round(float(r2_score(y, y_pred)), 6),   # 拟合优度
        "x_values": data[x_col].tolist(),                   # 原始 X
        "y_values": data[y_col].tolist(),                   # 原始 Y
        "y_predicted": [round(v, 4) for v in y_pred.tolist()],  # 预测 Y
        "x_col": x_col,
        "y_col": y_col,
    }