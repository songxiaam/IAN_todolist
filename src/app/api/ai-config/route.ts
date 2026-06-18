import { NextResponse } from 'next/server';
import {
  getAiRoutingSnapshot,
  listResolvedModels,
  reloadAiModelConfig,
} from '@/lib/ai';

/** 开发环境查看 / 热加载 AI 模型路由配置 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '仅开发环境可用' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('reload') === '1') {
    reloadAiModelConfig();
  }

  const snapshot = getAiRoutingSnapshot();
  return NextResponse.json({
    ...snapshot,
    resolved: {
      subject_detect: listResolvedModels('subject_detect'),
      vision_analyze: listResolvedModels('vision_analyze'),
      generate_similar: listResolvedModels('generate_similar'),
      handwriting_remove: listResolvedModels('handwriting_remove'),
    },
    usage: {
      configFile: 'config/ai-models.json',
      envOverrideExamples: [
        'AI_MODEL_VISION_MATH=qwen-vl-max',
        'AI_PROVIDER_GENERATE_MATH=deepseek',
        'AI_MODEL_GENERATE_MATH=deepseek-reasoner',
        'AI_MODEL_ROUTING_JSON={"vision_analyze":{"math":"qwen-vl-max"}}',
        'AI_MODEL_CONFIG=config/ai-models.dev.json',
      ],
    },
  });
}
