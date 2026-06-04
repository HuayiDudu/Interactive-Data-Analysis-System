/**
 * plot.js - 可视化模块前端逻辑
 * ====================================
 * 【负责人】可视化模块开发人员
 * 【依赖】Plotly.js CDN（在 index.html 中引入）
 *
 * 暴露给 Web 界面模块的接口:
 *   - populatePlotColumns(columns, dtypes) → 填充 X/Y 轴列选择下拉框
 *   - handlePlot(datasetI)        → 生成图表并渲染
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/plot)
 * - 使用 Plotly.js 渲染交互式图表
 */

// 存储当前图表实例，用于更新
let currentPlotDiv = null;
let currentPlotInstance = null;

// ================================================================
// 1. 填充列选择下拉框
// ================================================================

/**
 * 将数据集列名填充到 X 轴和 Y 轴的下拉框中。
 *
 * @param {string[]} columns - 所有列名
 * @param {object} dtypes - 列类型信息 {列名: 类型}
 */
function populatePlotColumns(columns, dtypes = {}) {
    const xSelect = document.getElementById('plot-x');
    const ySelect = document.getElementById('plot-y');
    const plotType = document.getElementById('plot-type').value;

    // 清空原有选项
    xSelect.innerHTML = '';
    ySelect.innerHTML = '';

    // 区分数值列和分类列
    const numericCols = [];
    const categoricalCols = [];

    columns.forEach(col => {
        const dtype = dtypes[col] || '';
        if (dtype.includes('int') || dtype.includes('float') || dtype === 'number') {
            numericCols.push(col);
        } else {
            categoricalCols.push(col);
        }
    });

    // 根据图表类型填充不同的选项
    if (plotType === 'pie') {
        // 饼图：X轴为分类列，Y轴为数值列
        categoricalCols.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            xSelect.appendChild(option);
        });

        numericCols.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            ySelect.appendChild(option);
        });
    } else {
        // 其他图表：X轴和Y轴都填数值列
        numericCols.forEach(col => {
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
}

// ================================================================
// 图表类型切换事件
// ================================================================
document.getElementById('plot-type').addEventListener('change', function() {
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
 * @returns {Promise<void>}
 */
async function handlePlot(datasetId) {
    try {
        // 1. 获取用户选择的值
        const xCol = document.getElementById('plot-x').value.trim();
        const yCol = document.getElementById('plot-y').value.trim();
        const plotType = document.getElementById('plot-type').value.trim();

        // 简单校验
        if (!xCol || !yCol || !plotType) {
            alert('请选择 X 轴、Y 轴和图表类型！');
            return;
        }

        const container = document.getElementById('plot-container');
        container.style.display = 'block';

        // 显示加载状态
        container.innerHTML = '<div class="text-center py-8"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div><p class="mt-2">正在生成图表...</p></div>';

        // 2. 发送请求到后端 /plot
        const response = await fetch('/plot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                x: xCol,
                y: yCol,
                type: plotType
            })
        });

        const result = await response.json();

        // 请求失败
        if (result.status === 'error') {
            container.innerHTML = `<div class="alert alert-danger text-center py-4">生成图表失败：${result.message}</div>`;
            return;
        }

        const data = result.data;

        // 3. 使用 Plotly 渲染交互式图表
        if (data.plotly_json) {
            try {
                // 解析 Plotly JSON
                const plotlyData = JSON.parse(data.plotly_json);
                
                // 如果已有图表，使用 react 更新；否则创建新图表
                if (!currentPlotDiv) {
                    currentPlotDiv = document.createElement('div');
                    currentPlotDiv.style.width = '100%';
                    currentPlotDiv.style.height = '450px';
                }
                
                container.innerHTML = '';
                container.appendChild(currentPlotDiv);
                
                // 使用 Plotly.react 更新或创建图表
                currentPlotInstance = await Plotly.react(
                    currentPlotDiv,
                    plotlyData.data,
                    plotlyData.layout,
                    {
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false
                    }
                );
                
            } catch (parseError) {
                console.error('Plotly JSON 解析失败:', parseError);
                container.innerHTML = '<div class="alert alert-danger text-center py-4">图表数据解析失败</div>';
            }
        } else {
            container.innerHTML = '<div class="alert alert-warning text-center py-4">后端未返回有效的图表数据</div>';
        }

    } catch (err) {
        console.error('图表请求异常：', err);
        const container = document.getElementById('plot-container');
        container.style.display = 'block';
        container.innerHTML = '<div class="alert alert-danger text-center py-4">网络错误或服务异常，请稍后重试</div>';
    }
}