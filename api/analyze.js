// api/analyze.js
const axios = require('axios');

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
        // 1. 从Vercel的环境变量中获取API Key
        const apiKey = process.env.QWEN_API_KEY;
        if (!apiKey) {
            console.error("Missing QWEN_API_KEY environment variable.");
            // 不向客户端暴露具体错误
            return res.status(500).json({ error: "Server configuration error." });
        }

        // 2. 构建 Qwen API 请求数据
        const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
        const requestData = {
            model: 'qwen-vl-max',
            input: {
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                image: dataUrl,
                            },
                            {
                                text: '你是一位顶级的营养分析师。请严格按照下面的【输出格式示例】，分析图片中的所有食物和饮料，并提供精确的营养估算。\n\n' +
                                '【输出格式示例】\n' +
                                '【食物识别】\n' +
                                '- 菜品1: 红烧肉, 约150g\n' +
                                '- 菜品2: 米饭, 约200g\n' +
                                '- 饮料1: 橙汁, 约300ml\n\n' +
                                '【营养分析】\n' +
                                '- 红烧肉: 热量: 595 kcal, 蛋白质: 15g, 碳水: 5g, 脂肪: 58g\n' +
                                '- 米饭: 热量: 260 kcal, 蛋白质: 5g, 碳水: 58g, 脂肪: 1g\n' +
                                '- 橙汁: 热量: 135 kcal, 蛋白质: 2g, 碳水: 30g, 脂肪: 0g\n\n' +
                                '【总计】\n' +
                                '- 总热量: 990 kcal\n' +
                                '- 总蛋白质: 22g\n' +
                                '- 总碳水化合物: 93g\n' +
                                '- 总脂肪: 59g\n\n' +
                                '【分析要求】\n' +
                                '1.  **全面识别**：不要遗漏任何食物、饮料、酱料或配菜。\n' +
                                '2.  **精确估算**：根据视觉信息合理估算每项的重量(g)或容量(ml)。\n' +
                                '3.  **考虑烹饪**：评估烹饪方式（如炒、炸、蒸）对营养的影响。\n' +
                                '4.  **处理未知**：如果无法识别，请在对应位置标注为“未知物品”。\n' +
                                '5.  **严格格式**：最终输出必须严格遵守【输出格式示例】，不要添加任何额外的解释或说明文字。',
                            },
                        ],
                    },
                ],
            },
        };

        // 3. 发送请求到 Qwen API
        const response = await axios.post(apiUrl, requestData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            // 设置一个合理的超时时间
            timeout: 30000, // 30秒
        });

        // 4. 解析并返回 API 结果
        const output = response.data.output;
        if (output && output.choices && output.choices.length > 0) {
            const messageContent = output.choices[0].message.content;
            let extractedText = '';
            if (Array.isArray(messageContent)) {
                extractedText = messageContent.filter(item => item.text).map(item => item.text).join('\n');
            } else if (typeof messageContent === 'string') {
                extractedText = messageContent;
            } else {
                console.error("API returned unexpected content format:", messageContent);
                return res.status(500).json({ error: "API returned unexpected content format" });
            }
            // 将提取的文本作为JSON响应的一部分返回
            return res.status(200).json({ result: extractedText });
        } else {
            // 如果响应格式不符合预期
            console.error("API response format is unexpected:", response.data);
            return res.status(500).json({ error: "API returned an unexpected data structure." });
        }

    } catch (error) {
        console.error('API call failed:', error.message);
        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
            // 将API的错误信息传递给客户端，但可能需要更通用的错误消息
            return res.status(error.response.status).json({ 
                error: `API Error: ${error.response.data.message || 'Failed to get a valid response'}` 
            });
        } else if (error.request) {
            return res.status(504).json({ error: 'Network Error: No response from API server.' });
        } else {
            return res.status(500).json({ error: `Request Error: ${error.message}` });
        }
    }
};
