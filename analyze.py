from flask import Blueprint, request, jsonify
from services.analyze_service import run_kmeans, run_linear_regression
from repositories import get_repo   # 用项目统一的 repo 接口获取数据

analyze_bp = Blueprint("analyze", __name__, url_prefix="/analyze")


def _load_df(dataset_id: str):
    """通过 repository 加载 DataFrame，若无则报错"""
    repo = get_repo()
    df = repo.load(dataset_id)
    if df is None:
        raise FileNotFoundError(f"找不到数据集：{dataset_id}")
    return df


@analyze_bp.route("/kmeans", methods=["POST"])
def kmeans():
    """
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "columns": ["col1", "col2"],
      "n_clusters": 3
    }
    """
    try:
        body = request.get_json(force=True)
        dataset_id = body["dataset_id"]
        columns = body["columns"]
        n_clusters = int(body.get("n_clusters", 3))

        df = _load_df(dataset_id)
        result = run_kmeans(df, columns, n_clusters)
        return jsonify({"status": "ok", "data": result})

    except (KeyError, TypeError) as e:
        return jsonify({"status": "error", "message": f"参数缺失或格式错误：{e}"}), 400
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 422
    except FileNotFoundError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"服务器内部错误：{e}"}), 500


@analyze_bp.route("/regression", methods=["POST"])
def regression():
    """
    请求体 JSON：
    {
      "dataset_id": "xxx",
      "x_col": "age",
      "y_col": "salary"
    }
    """
    try:
        body = request.get_json(force=True)
        dataset_id = body["dataset_id"]
        x_col = body["x_col"]
        y_col = body["y_col"]

        df = _load_df(dataset_id)
        result = run_linear_regression(df, x_col, y_col)
        return jsonify({"status": "ok", "data": result})

    except (KeyError, TypeError) as e:
        return jsonify({"status": "error", "message": f"参数缺失或格式错误：{e}"}), 400
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 422
    except FileNotFoundError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"服务器内部错误：{e}"}), 500