/**
 * plot.js - 可视化模块前端逻辑
 * ====================================
 * 【负责人】可视化模块开发人员
 * 【依赖】Plotly.js CDN（在 index.html 中引入）
 *
 * 暴露给 Web 界面模块的接口:
 *   - populatePlotColumns(columns, dtypes) → 填充 X/Y 轴列选择下拉框
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
 * @param {object} dtypes - 列类型信息 {列名: 类型}
 */
function populatePlotColumns(columns, dtypes) {
    dtypes = dtypes || {};
    const xSelect = document.getElementById('plot-x');
    const ySelect = document.getElementById('plot-y');
    const plotType = document.getElementById('plot-type').value;

    xSelect.innerHTML = '';
    ySelect.innerHTML = '';

    const numericCols = [];
    const categoricalCols = [];

    columns.forEach(function (col) {
        const dtype = dtypes[col] || '';
        if (dtype.includes('int') || dtype.includes('float') || dtype === 'number') {
            numericCols.push(col);
        } else {
            categoricalCols.push(col);
        }
    });

    if (plotType === 'pie') {
        categoricalCols.forEach(function (col) {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            xSelect.appendChild(option);
        });
        numericCols.forEach(function (col) {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            ySelect.appendChild(option);
        });
    } else {
        numericCols.forEach(function (col) {
            const optionX = document.createElement('option');
            optionX.value = col;
            optionX.textContent = col;
            xSelect.appendChild(optionX);
            const optionY = document.createElement('option');
            optionY.value = col;
            optionY.textContent = col;
            ySelect.appendChild(optionY);
        });
    }

    if (xSelect.options.length > 0) xSelect.selectedIndex = 0;
    if (ySelect.options.length > 0) ySelect.selectedIndex = Math.min(1, ySelect.options.length - 1);
}

// ================================================================
// 图表类型切换事件
// ================================================================
document.getElementById('plot-type').addEventListener('change', function () {
    if (typeof populatePlotColumns === 'function' && typeof currentColumns !== 'undefined' && currentColumns.length > 0) {
        populatePlotColumns(currentColumns, currentDtypes);
    }
});

// ================================================================
// 2. 生成图表
// ================================================================

/**
 * 根据用户配置生成图表并渲染到页面。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @returns {Promise<object>} 后端返回的 data 对象
 * @throws {Error} 生成失败时抛出
 */
async function handlePlot(datasetId) {
    try {
        const xCol = document.getElementById('plot-x').value.trim();
        const yCol = document.getElementById('plot-y').value.trim();
        const plotType = document.getElementById('plot-type').value.trim();

        if (!xCol || !yCol || !plotType) {
            throw new Error('请选择 X 轴、Y 轴和图表类型');
        }

        const response = await fetch('/plot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataset_id: datasetId,
                x: xCol,
                y: yCol,
                type: plotType,
            }),
        });

        const result = await response.json();
        if (result.status === 'error') {
            throw new Error(result.message || '生成图表失败');
        }

        renderChart(result.data);
        return result.data;

    } catch (err) {
        console.error('图表请求异常：', err);
        throw err;  // 让 app.js 的 catch 处理
    }
}

/**
 * 根据后端返回的数据渲染图表。
 *
 * @param {object} data - { plotly_json } 或 { image_base64 }
 */
function renderChart(data) {
    const container = document.getElementById('plot-container');
    container.style.display = 'block';
    container.innerHTML = '';

    if (data.plotly_json) {
        const plotDiv = document.createElement('div');
        plotDiv.style.width = '100%';
        plotDiv.style.height = '450px';
        container.appendChild(plotDiv);

        const parsed = typeof data.plotly_json === 'string'
            ? JSON.parse(data.plotly_json)
            : data.plotly_json;

        Plotly.newPlot(plotDiv, parsed.data || parsed, parsed.layout || {}, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
        });
    } else if (data.image_base64) {
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,' + data.image_base64;
        img.style.maxWidth = '100%';
        container.appendChild(img);
    } else {
        throw new Error('后端未返回有效的图表数据');
    }
}
