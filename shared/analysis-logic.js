const axios = require('axios');

async function performAnalysis(dataUrl, platform) {
    // 根据平台选择API端点
    const apiUrl = platform === 'netlify'
        ? 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
        : 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
        throw new Error("服务器配置错误：API密钥未设置");
    }

    const requestData = {
        model: 'qwen-vl-max',
        input: {
            messages: [
                {
                    role: 'user',
                    content: [
                        { image: dataUrl },
                        { text: '你是一位顶级的营养分析师。请严格按照下面的【输出格式示例】，分析图片中的所有食物和饮料，并提供精确的营养估算。\n\n' +
                                    '【输出格式示例】\n' +
                                    '【食物识别】\n' +
                                    '- 菜品1: 红烧肉, 约150g\n' +
                                    '- 菜品2: 米饭, 约200g\n' +
                                    '- 饮料 1: 橙汁, 约300ml\n\n' +
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
                                    '5.  **严格格式**：最终输出必须严格遵守【输出格式示例】，不要添加任何额外的解释或说明文字。' }
                    ]
                }
            ]
        },
        parameters: {
            result_format: "message"
        }
    };

    const response = await axios.post(apiUrl, requestData, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const output = response.data.output;
    if (output && output.choices && output.choices.length > 0) {
        const extractedText = output.choices[0].message.content;
        
        // 改进后的正则表达式，使用多行模式
        const calorieMatch = extractedText.match(/总热量[：:]\s*(\d+)\s*kcal/im);
        const totalCalories = calorieMatch ? parseInt(calorieMatch[1], 10) : 0;

        const isFood = extractedText.toLowerCase().includes('食物') || totalCalories > 0;

        return {
            isFood: isFood,
            foods: [], // 暂时保持为空，前端主要使用description
            totalCalories: totalCalories,
            description: extractedText
        };
    } else {
        throw new Error("API返回了意料之外的数据结构");
    }
}

module.exports = { performAnalysis };
