import type { ResolvedModel } from './types';

async function chatCompletion(
  resolved: ResolvedModel,
  messages: { role: string; content: unknown }[],
  jsonMode = false,
  temperature = 0.3,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: resolved.model,
    messages,
    temperature,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${resolved.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolved.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `AI 请求失败 [${resolved.provider}/${resolved.model}] (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`AI 返回内容为空 [${resolved.provider}/${resolved.model}]`);
  }
  return content;
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

function imageMessagePart(imageBuffer: Buffer, mimeType: string) {
  const base64 = imageBuffer.toString('base64');
  return {
    type: 'image_url' as const,
    image_url: { url: `data:${mimeType};base64,${base64}` },
  };
}

export { chatCompletion, parseJson, imageMessagePart };
