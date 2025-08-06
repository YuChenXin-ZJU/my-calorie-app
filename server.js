// 检测运行环境
if (process.env.VERCEL) {
    console.log('检测到 Vercel 环境，使用 serverless 模式');
    // 在 Vercel 环境下不启动 Express 服务器
    process.exit(0);
}

const express = require('express');
const path = require('path');
const { performAnalysis } = require('./shared/analysis-logic');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// API 路由
app.post('/api/analyze', async (req, res) => {
    try {
        const { dataUrl } = req.body;
        
        if (!dataUrl) {
            return res.status(400).json({ error: '缺少图片数据' });
        }

        // 使用共享的分析逻辑，指定 zeabur 平台
        const result = await performAnalysis(dataUrl, 'zeabur');
        
        res.json({ result });
    } catch (error) {
        console.error('分析失败:', error);
        res.status(500).json({ 
            error: error.message || '分析失败，请重试' 
        });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`访问地址: http://localhost:${PORT}`);
});
