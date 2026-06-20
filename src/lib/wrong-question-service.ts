import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { analyzeWrongQuestionCrop } from '@/lib/ai';
import { cropImageBuffer, type NormalizedBBox } from '@/lib/image-crop';

const BUCKET = 'wrong-questions';

interface CreateWrongQuestionInput {
  studentId: string;
  familyId: string;
  sourceBuffer: Buffer;
  sourceMime: string;
  sourcePath: string;
  bbox: NormalizedBBox;
  sourceType: 'crop' | 'grading';
  sourceGradingQuestionId?: number;
  subjectHint?: string;
  prefilled?: {
    subject?: string;
    question_text?: string;
    student_answer?: string;
    correct_answer?: string;
    solution_steps?: string;
    error_analysis?: string;
  };
}

async function uploadWrongQuestionCrop(
  familyId: string,
  studentId: string,
  cropBuffer: Buffer,
  ext = 'jpg',
): Promise<string> {
  const admin = getSupabaseAdminClient();
  const path = `${familyId}/${studentId}/crops/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, cropBuffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function buildWrongQuestionRecord(input: CreateWrongQuestionInput) {
  const cropBuffer = await cropImageBuffer(input.sourceBuffer, input.bbox);
  const cropPath = await uploadWrongQuestionCrop(
    input.familyId,
    input.studentId,
    cropBuffer,
  );

  let analysis = input.prefilled
    ? {
        subject: input.prefilled.subject || '其他',
        question: input.prefilled.question_text || '',
        student_answer: input.prefilled.student_answer || '',
        correct_answer: input.prefilled.correct_answer || '',
        error_analysis: input.prefilled.error_analysis || '',
        knowledge_points: [] as string[],
        solution_steps: input.prefilled.solution_steps || input.prefilled.correct_answer || '',
      }
    : null;

  if (!analysis) {
    const ai = await analyzeWrongQuestionCrop(
      cropBuffer,
      'image/jpeg',
      input.subjectHint,
    );
    analysis = {
      subject: ai.subject,
      question: ai.question,
      student_answer: ai.student_answer,
      correct_answer: ai.correct_answer,
      error_analysis: ai.error_analysis,
      knowledge_points: ai.knowledge_points,
      solution_steps: ai.correct_answer,
    };
  }

  return {
    student_id: input.studentId,
    family_id: input.familyId,
    subject: analysis.subject,
    image_path: cropPath,
    original_image_path: input.sourcePath,
    crop_bbox: JSON.stringify(input.bbox),
    source_type: input.sourceType,
    source_grading_question_id: input.sourceGradingQuestionId ?? null,
    question_text: analysis.question,
    student_answer: analysis.student_answer,
    correct_answer: analysis.correct_answer,
    solution_steps: analysis.solution_steps,
    error_analysis: analysis.error_analysis,
    knowledge_points: JSON.stringify(analysis.knowledge_points),
    mastery_level: 0,
    mastered: false,
  };
}

export { buildWrongQuestionRecord, uploadWrongQuestionCrop, BUCKET as WRONG_QUESTIONS_BUCKET };
