import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/api-auth';
import { detectQuestionRegions } from '@/lib/ai/detect-regions';
import { isAiConfigured } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: '未配置 AI 接口' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传照片' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const regions = await detectQuestionRegions(buffer, file.type);
    return NextResponse.json({ regions });
  } catch (error) {
    const message = error instanceof Error ? error.message : '识别失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
