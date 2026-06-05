"""
services/analyze_service.py - 数据分析服务
============================================
【层】业务逻辑层（Service）
【说明】提供机器学习分析功能：K-Means/DBSCAN 聚类、线性/多项式回归、算法对比。
        所有方法通过 DatasetRef 获取数据，保持对 Repository 抽象的依赖。
        提供 analyze() 统一分发入口和独立的丰富接口两套 API。
【负责人】分析功能模块开发人员
"""

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

from repositories.base import DataRepository
from value_objects import DatasetRef


class AnalyzeService:
    """
    数据分析服务。

    两套 API：
    (1) analyze() 统一分发入口 — 符合开发文档接口契约
    (2) 各算法独立方法（kmeans/dbscan/linear_regression/...）— 参数展开，类型安全

    支持算法:
        - kmeans: K-Means 聚类
        - dbscan: DBSCAN 密度聚类
        - linear_regression: 线性回归（支持多特征）
        - polynomial_regression: 多项式回归
        - compare_clustering: 聚类多算法对比
        - compare_regression: 回归多算法对比
    """

    def __init__(self, repo: DataRepository):
        self.repo = repo

    def _load_data(self, ref: DatasetRef) -> pd.DataFrame:
        """通过 Repository 加载数据集。"""
        df = self.repo.load_data(ref)
        if df is None:
            raise FileNotFoundError(f"找不到数据集：{ref.id}")
        return df

    # ═══════════════════════════════════════════════
    #  统一分发入口（开发文档 4.1 接口契约）
    # ═══════════════════════════════════════════════

    def analyze(self, dataset_ref: DatasetRef, algorithm: str, params: dict) -> dict:
        """
        数据分析统一入口。

        按 algorithm 分发到对应的内部 _*_analysis 方法，
        params 字典透传，支持未来的自定义算法扩展。

        Args:
            dataset_ref: 数据集引用。
            algorithm: 算法类型。
            params: 算法参数字典（不包含 dataset_id 和 algorithm）。

        Returns:
            各算法的结果字典。

        Raises:
            ValueError: 不支持的算法类型。
        """
        df = self._load_data(dataset_ref)

        dispatch = {
            "kmeans": self._kmeans_analysis,
            "dbscan": self._dbscan_analysis,
            "linear_regression": self._linear_regression_analysis,
            "polynomial_regression": self._polynomial_regression_analysis,
            "compare_clustering": self._compare_clustering_analysis,
            "compare_regression": self._compare_regression_analysis,
        }

        handler = dispatch.get(algorithm)
        if handler is None:
            raise ValueError(f"不支持的算法: {algorithm}")

        return handler(df, params)

    # ═══════════════════════════════════════════════
    #  内部 _*_analysis 方法（单数据源，供 analyze() 和公有方法共用）
    # ═══════════════════════════════════════════════

    def _kmeans_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        K-Means 聚类内部实现。

        Args:
            df: 已加载的 DataFrame。
            params: {
                "columns": [...],      ← 可选，默认所有数值列
                "n_clusters": 3,       ← 可选，默认 3
            }
        """
        columns = params.get("columns") or [
            c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])
        ]
        n_clusters = params.get("n_clusters", 3)

        if len(columns) < 1:
            raise ValueError("至少需要选择一列")
        if not (2 <= n_clusters <= 10):
            raise ValueError("K 值应在 2~10 之间")

        numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
        skipped_cols = [c for c in columns if c not in numeric_cols]
        if not numeric_cols:
            raise ValueError("所选列中不含任何数值列，无法聚类")

        data = df[numeric_cols].dropna()
        if len(data) < n_clusters:
            raise ValueError("数据行数不能少于 K 值")

        # model = StandardScaler().fit_transform(data)  # 可选：特征标准化
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
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

    def _dbscan_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        DBSCAN 密度聚类内部实现。

        Args:
            df: 已加载的 DataFrame。
            params: {
                "columns": [...],          ← 可选，默认所有数值列
                "eps": 0.5,                ← 可选
                "min_samples": 5,          ← 可选
            }
        """
        columns = params.get("columns") or [
            c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])
        ]
        eps = params.get("eps", 0.5)
        min_samples = params.get("min_samples", 5)

        if len(columns) < 1:
            raise ValueError("至少需要选择一列")
        if eps <= 0:
            raise ValueError("eps 必须大于 0")
        if min_samples < 1:
            raise ValueError("min_samples 至少为 1")

        numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
        skipped_cols = [c for c in columns if c not in numeric_cols]
        if not numeric_cols:
            raise ValueError("所选列中不含任何数值列，无法聚类")

        data = df[numeric_cols].dropna()
        if len(data) < min_samples:
            raise ValueError(f"有效数据行数（{len(data)}）不足 min_samples（{min_samples}）")

        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data)

        model = DBSCAN(eps=eps, min_samples=min_samples)
        labels = model.fit_predict(data_scaled)

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = int(np.sum(labels == -1))

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

    def _linear_regression_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        线性回归内部实现。

        Args:
            df: 已加载的 DataFrame。
            params: {
                "feature_cols": [...],     ← 自变量列名列表
                "target_col": "...",       ← 因变量列名
            }
        """
        feature_cols = params.get("feature_cols", [])
        target_col = params.get("target_col", "")

        if not feature_cols:
            raise ValueError("至少需要选择一个特征列")
        if not target_col:
            raise ValueError("需要指定目标列")

        non_numeric_features = [c for c in feature_cols if not pd.api.types.is_numeric_dtype(df[c])]
        if non_numeric_features:
            raise ValueError(f"特征列包含非数值类型，无法回归：{non_numeric_features}")
        if not pd.api.types.is_numeric_dtype(df[target_col]):
            raise ValueError(f"目标列 '{target_col}' 不是数值类型，无法回归")

        cols = feature_cols + [target_col]
        data = df[cols].dropna()
        if len(data) < 2:
            raise ValueError("有效数据行数不足，无法回归")

        X = data[feature_cols].values
        y = data[target_col].values

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
            "r2_score": r2,
            "slope": coefficients[0] if len(coefficients) == 1 else None,
            "mae": mae,
            "rmse": rmse,
            "x_values": data[feature_cols[0]].tolist() if len(feature_cols) == 1 else None,
            "y_values": data[target_col].tolist(),
            "y_predicted": [round(v, 4) for v in y_pred.tolist()],
            "feature_cols": feature_cols,
            "target_col": target_col,
        }

    def _polynomial_regression_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        多项式回归内部实现。

        Args:
            df: 已加载的 DataFrame。
            params: {
                "feature_col": "...",      ← 自变量列名
                "target_col": "...",       ← 因变量列名
                "degree": 2,               ← 可选，默认 2
            }
        """
        feature_col = params.get("feature_col", "")
        target_col = params.get("target_col", "")
        degree = params.get("degree", 2)

        if not feature_col:
            raise ValueError("需要指定特征列 feature_col")
        if not target_col:
            raise ValueError("需要指定目标列 target_col")
        if not (2 <= degree <= 5):
            raise ValueError("多项式阶数应在 2~5 之间")

        if not pd.api.types.is_numeric_dtype(df[feature_col]):
            raise ValueError(f"特征列 '{feature_col}' 不是数值类型，无法回归")
        if not pd.api.types.is_numeric_dtype(df[target_col]):
            raise ValueError(f"目标列 '{target_col}' 不是数值类型，无法回归")

        data = df[[feature_col, target_col]].dropna()
        if len(data) < degree + 1:
            raise ValueError(f"有效数据行数（{len(data)}）不足以拟合 {degree} 阶多项式")

        X = data[[feature_col]].values
        y = data[target_col].values

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
            "coefficients": coefficients,
            "intercept": intercept,
            "r2_score": r2,
            "r_squared": r2,
            "mae": round(float(mean_absolute_error(y, y_pred)), 6),
            "rmse": round(float(np.sqrt(mean_squared_error(y, y_pred))), 6),
            "x_values": data[feature_col].tolist(),
            "y_values": data[target_col].tolist(),
            "y_predicted": [round(v, 4) for v in y_pred.tolist()],
            "feature_col": feature_col,
            "target_col": target_col,
        }

    def _compare_clustering_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        聚类对比内部实现。
        params 直接透传给 kmeans/dbscan 独立方法（参数一致）。
        """
        results = {}
        errors = {}

        try:
            results["kmeans"] = self._kmeans_analysis(df, params)
        except Exception as e:
            errors["kmeans"] = str(e)

        try:
            results["dbscan"] = self._dbscan_analysis(df, params)
        except Exception as e:
            errors["dbscan"] = str(e)

        if not results:
            raise ValueError("所有聚类算法均运行失败：" + str(errors))

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

        return {"results": results, "summary": summary, "errors": errors}

    def _compare_regression_analysis(self, df: pd.DataFrame, params: dict) -> dict:
        """
        回归对比内部实现。

        线性模型使用 feature_cols 全部特征列。
        多项式回归使用 feature_cols[0] + degree。
        """
        feature_cols = params.get("feature_cols", [])
        target_col = params.get("target_col", "")
        degree = params.get("degree", 2)

        if not feature_cols:
            raise ValueError("至少需要选择一个特征列")
        if not target_col:
            raise ValueError("需要指定目标列")

        non_numeric_features = [c for c in feature_cols if not pd.api.types.is_numeric_dtype(df[c])]
        if non_numeric_features:
            raise ValueError(f"特征列包含非数值类型，无法回归对比：{non_numeric_features}")
        if not pd.api.types.is_numeric_dtype(df[target_col]):
            raise ValueError(f"目标列 '{target_col}' 不是数值类型，无法回归对比")

        cols = feature_cols + [target_col]
        data = df[cols].dropna()
        if len(data) < 4:
            raise ValueError("有效数据行数不足，无法进行算法对比")

        X = data[feature_cols].values
        y = data[target_col].values

        linear_algos = {
            "线性回归": LinearRegression(),
            "Ridge 回归": Ridge(alpha=1.0),
            "Lasso 回归": Lasso(alpha=0.1, max_iter=10000),
        }

        results = {}
        summary = []

        for name, algo in linear_algos.items():
            algo.fit(X, y)
            y_pred = algo.predict(X)
            r2 = round(float(r2_score(y, y_pred)), 6)
            mae = round(float(mean_absolute_error(y, y_pred)), 6)
            rmse = round(float(np.sqrt(mean_squared_error(y, y_pred))), 6)
            results[name] = {
                "r2_score": r2,
                "r_squared": r2,
                "mae": mae,
                "rmse": rmse,
                "y_predicted": [round(v, 4) for v in y_pred.tolist()],
            }
            summary.append({"算法": name, "R² ↑": r2, "MAE ↓": mae, "RMSE ↓": rmse, "最优": ""})

        poly_feature = feature_cols[0]
        poly_name = f"多项式回归（{degree} 阶，基于 {poly_feature}）"
        try:
            poly_result = self._polynomial_regression_analysis(df, {
                "feature_col": poly_feature,
                "target_col": target_col,
                "degree": degree,
            })
            results[poly_name] = poly_result
            summary.append({
                "算法": poly_name,
                "R² ↑": poly_result["r2_score"],
                "MAE ↓": poly_result["mae"],
                "RMSE ↓": poly_result["rmse"],
                "最优": "",
            })
        except Exception as e:
            results[poly_name] = {"error": str(e)}
            summary.append({
                "算法": poly_name,
                "R² ↑": "失败",
                "MAE ↓": "失败",
                "RMSE ↓": str(e),
                "最优": "",
            })

        valid_rows = [row for row in summary if isinstance(row.get("R² ↑"), float)]
        if valid_rows:
            best_name = max(valid_rows, key=lambda r: r["R² ↑"])["算法"]
            for row in summary:
                row["最优"] = "✓" if row["算法"] == best_name else ""

        return {
            "results": results,
            "summary": summary,
            "x_values": data[feature_cols[0]].tolist(),
            "y_values": data[target_col].tolist(),
            "feature_cols": feature_cols,
            "target_col": target_col,
        }

    # ═══════════════════════════════════════════════
    #  公有独立方法（参数展开、类型安全、默认值友好）
    #  每个方法：加载数据 → 委托给 _*_analysis 内部方法
    # ═══════════════════════════════════════════════

    def kmeans(
        self,
        dataset_ref: DatasetRef,
        columns: list | None = None,
        n_clusters: int = 3,
    ) -> dict:
        """
        K-Means 聚类（参数展开的便利接口）。

        不传 columns 时自动使用全部数值列。
        """
        df = self._load_data(dataset_ref)
        return self._kmeans_analysis(df, {
            "columns": columns,
            "n_clusters": n_clusters,
        })

    def dbscan(
        self,
        dataset_ref: DatasetRef,
        columns: list | None = None,
        eps: float = 0.5,
        min_samples: int = 5,
    ) -> dict:
        """
        DBSCAN 密度聚类（参数展开的便利接口）。
        """
        df = self._load_data(dataset_ref)
        return self._dbscan_analysis(df, {
            "columns": columns,
            "eps": eps,
            "min_samples": min_samples,
        })

    def linear_regression(
        self,
        dataset_ref: DatasetRef,
        feature_cols: list,
        target_col: str,
    ) -> dict:
        """
        线性回归（参数展开的便利接口）。
        """
        df = self._load_data(dataset_ref)
        return self._linear_regression_analysis(df, {
            "feature_cols": feature_cols,
            "target_col": target_col,
        })

    def polynomial_regression(
        self,
        dataset_ref: DatasetRef,
        feature_col: str,
        target_col: str,
        degree: int = 2,
    ) -> dict:
        """
        多项式回归（参数展开的便利接口）。
        """
        df = self._load_data(dataset_ref)
        return self._polynomial_regression_analysis(df, {
            "feature_col": feature_col,
            "target_col": target_col,
            "degree": degree,
        })

    def compare_clustering(
        self,
        dataset_ref: DatasetRef,
        columns: list | None = None,
        n_clusters: int = 3,
        eps: float = 0.5,
        min_samples: int = 5,
    ) -> dict:
        """
        聚类多算法对比：K-Means vs DBSCAN。
        """
        df = self._load_data(dataset_ref)
        return self._compare_clustering_analysis(df, {
            "columns": columns,
            "n_clusters": n_clusters,
            "eps": eps,
            "min_samples": min_samples,
        })

    def compare_regression(
        self,
        dataset_ref: DatasetRef,
        feature_cols: list,
        target_col: str,
        degree: int = 2,
    ) -> dict:
        """
        回归多算法对比：线性 / Ridge / Lasso / 多项式。
        """
        df = self._load_data(dataset_ref)
        return self._compare_regression_analysis(df, {
            "feature_cols": feature_cols,
            "target_col": target_col,
            "degree": degree,
        })
