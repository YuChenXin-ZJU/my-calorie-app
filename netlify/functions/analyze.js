const { performAnalysis } = require('../../shared/analysis-logic');

/**
 * Netlify Functions处理器
 * @param {Object} event - Netlify函数事件对象
 * @param {Object} context - Netlify函数上下文对象
 * @returns {Object} HTTP响应对象
 */
exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 只处理POST请求
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '只支持POST方法' }) };
    }

    let dataUrl;
    try {
        // 解析请求体
        const body = JSON.parse(event.body || '{}');
        dataUrl = body.dataUrl;
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '请求体中的JSON无效' }) };
    }

    if (!dataUrl) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '请求体中缺少dataUrl' }) };
    }

    try {
        console.log('准备调用共享分析逻辑');

        // 调用共享逻辑，并指明平台是'netlify'
        const result = await performAnalysis(dataUrl, 'netlify');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, result, timestamp: new Date().toISOString() })
        };
    } catch (error) {
        console.error('函数执行失败:', error.message);
        let statusCode = 500;
        if (error.message.includes("API返回")) statusCode = 502;
        if (error.message.includes("Network")) statusCode = 504;
        
        return {
            statusCode,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
