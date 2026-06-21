-- 错题只存原图 + 框选坐标，不再单独存裁剪图
ALTER TABLE wrong_questions ALTER COLUMN image_path DROP NOT NULL;
