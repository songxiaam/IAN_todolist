import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedBBox } from '@/lib/image-crop-types';

const WRONG_QUESTIONS_BUCKET = 'wrong-questions';
const GRADING_BUCKET = 'homework-grading';

interface WrongQuestionRow {
  id: number;
  image_path: string | null;
  original_image_path: string | null;
  crop_bbox: string | null;
  source_type: string | null;
  [key: string]: unknown;
}

function getOriginalImageBucket(sourceType: string | null): string {
  return sourceType === 'grading' ? GRADING_BUCKET : WRONG_QUESTIONS_BUCKET;
}

function parseCropBBox(raw: string | null): NormalizedBBox | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NormalizedBBox;
  } catch {
    return null;
  }
}

function serializeWrongQuestion(
  item: WrongQuestionRow,
  admin: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } },
) {
  const sourceType = item.source_type ?? 'crop';
  const bucket = getOriginalImageBucket(sourceType);

  let original_image_url: string | null = null;
  if (item.original_image_path) {
    original_image_url = admin.storage.from(bucket).getPublicUrl(item.original_image_path).data.publicUrl;
  }

  let legacy_image_url: string | null = null;
  if (item.image_path) {
    legacy_image_url = admin.storage
      .from(WRONG_QUESTIONS_BUCKET)
      .getPublicUrl(item.image_path).data.publicUrl;
  }

  const crop_bbox = parseCropBBox(item.crop_bbox);

  return {
    ...item,
    original_image_url,
    crop_bbox,
    legacy_image_url,
    /** @deprecated 请用 original_image_url + crop_bbox 客户端裁剪 */
    image_url: legacy_image_url,
  };
}

async function countSharedOriginalSources(
  client: SupabaseClient,
  originalPath: string,
  excludeId?: number,
): Promise<number> {
  let query = client
    .from('wrong_questions')
    .select('*', { count: 'exact', head: true })
    .eq('original_image_path', originalPath)
    .eq('source_type', 'crop');

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { count } = await query;
  return count ?? 0;
}

export {
  WRONG_QUESTIONS_BUCKET,
  GRADING_BUCKET,
  getOriginalImageBucket,
  parseCropBBox,
  serializeWrongQuestion,
  countSharedOriginalSources,
};
