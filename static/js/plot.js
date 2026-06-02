/**
 * plot.js - 可视化模块前端逻辑
 * ====================================
 * 【负责人】可视化模块开发人员
 * 【依赖】如果使用 Plotly 方案，需在 index.html 中引入 Plotly.js CDN
 *
 * 暴露给 Web 界面模块的接口:
 *   - populatePlotColumns(columns) → 填充 X/Y 轴列选择下拉框
 *   - handlePlot(datasetId)        → 生成图表并渲染
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/plot)
 * - 支持 Matplotlib base64 和 Plotly JSON 两种返回格式
 */

// ================================================================
// 1. 填充列选择下拉框
// ================================================================

/**
 * 将数据集列名填充到 X 轴和 Y 轴的下拉框中。
 *
 * @param {string[]} columns - 所有列名
 */
function populatePlotColumns(columns) {
    var selectX = document.getElementById("plot-x");
    var selectY = document.getElementById("plot-y");

    selectX.innerHTML = "";
    selectY.innerHTML = "";

    columns.forEach(function (col) {
        var optionX = document.createElement("option");
        optionX.value = col;
        optionX.textContent = col;
        selectX.appendChild(optionX);

        var optionY = document.createElement("option");
        optionY.value = col;
        optionY.textContent = col;
        selectY.appendChild(optionY);
    });

    if (columns.length >= 2) {
        selectX.selectedIndex = 0;
        selectY.selectedIndex = 1;
    }
}

// ================================================================
// 2. 生成图表
// ================================================================

/**
 * 根据用户配置生成图表并渲染到页面。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @returns {Promise<object>} 后端返回的 data 对象，包含 plotly_json 或 image_base64
 * @throws {Error} 生成失败时抛出
 */
async function handlePlot(datasetId) {
    var x = document.getElementById("plot-x").value;
    var y = document.getElementById("plot-y").value;
    var type = document.getElementById("plot-type").value;

    if (!x || !y) {
        throw new Error("请选择 X 轴和 Y 轴列");
    }

    var response = await fetch("/plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            dataset_id: datasetId,
            x: x,
            y: y,
            type: type,
        }),
    });
    var result = await response.json();
    if (result.status === "error") {
        throw new Error(result.message || "生成图表失败");
    }

    renderChart(result.data);
    return result.data;
}

/**
 * 根据后端返回的数据渲染图表。
 *
 * @param {object} data - { plotly_json } 或 { image_base64 }
 */
function renderChart(data) {
    var container = document.getElementById("plot-container");
    var chartDiv = document.getElementById("plotly-chart");

    if (data.plotly_json) {
        var plotData = data.plotly_json;
        if (typeof plotData === "string") {
            plotData = JSON.parse(plotData);
        }
        var layout = plotData.layout || {};
        layout.paper_bgcolor = "rgba(0,0,0,0)";
        layout.plot_bgcolor = "rgba(0,0,0,0)";
        layout.font = { color: "#ffffff" };
        layout.xaxis = layout.xaxis || {};
        layout.xaxis.gridcolor = "rgba(255,255,255,0.05)";
        layout.xaxis.zerolinecolor = "rgba(255,255,255,0.08)";
        layout.yaxis = layout.yaxis || {};
        layout.yaxis.gridcolor = "rgba(255,255,255,0.05)";
        layout.yaxis.zerolinecolor = "rgba(255,255,255,0.08)";
        Plotly.newPlot("plotly-chart", plotData.data || plotData, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
        });
    } else if (data.image_base64) {
        var img = document.createElement("img");
        img.src = "data:image/png;base64," + data.image_base64;
        img.style.maxWidth = "100%";
        img.style.display = "block";
        chartDiv.innerHTML = "";
        chartDiv.appendChild(img);
    }

    container.style.display = "block";
}
