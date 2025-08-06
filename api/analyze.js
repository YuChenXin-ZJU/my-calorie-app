// api/analyze.js
const { performAnalysis } = require('../shared/analysis-logic');

// Vercel Serverless Function
module.exports = async (req, res) => {
    // 只允许POST请求
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    // Vercel会自动解析JSON请求体
    const { dataUrl } = req.body;

    if (!dataUrl) {
        return res.status(400).json({ error: 'Missing dataUrl in request body' });
    }

    try {
        // 调用共享逻辑，并指明平台是'vercel'
        const result = await performAnalysis(dataUrl, 'vercel');
        return res.status(200).json({ success: true, result, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('API call failed:', error.message);
        // 根据错误类型返回不同的状态码
        if (error.message.includes("配置错误")) {
            return res.status(500).json({ error: error.message });
        } else if (error.message.includes("API返回")) {
            return res.status(502).json({ error: error.message });
        } else {
            return res.status(504).json({ error: `Network or other error: ${error.message}` });
        }
    }
};
