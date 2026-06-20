'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ImageIcon, SwitchCamera } from 'lucide-react';
import { StudentPicker, getDefaultStudentId } from '@/components/student-picker';

export type CaptureMode = 'wrong' | 'grading';

export interface PendingCapture {
  file: File;
  studentId?: string;
  nonce: number;
}

interface CameraCaptureOverlayProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, mode: CaptureMode, studentId?: string) => void;
  role: 'parent' | 'student';
  students: { id: string; name: string }[];
}

export function CameraCaptureOverlay({
  open,
  onClose,
  onCapture,
  role,
  students,
}: CameraCaptureOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CaptureMode>('wrong');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(() => getDefaultStudentId(students));

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('无法打开相机，请检查权限或使用相册选图');
    } finally {
      setStarting(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setMode('wrong');
    setSelectedStudentId(getDefaultStudentId(students));
    void startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera, students]);

  useEffect(() => {
    if (open) void startCamera();
  }, [facingMode, open, startCamera]);

  const canCapture = role === 'student' || (role === 'parent' && !!selectedStudentId);

  const deliverFile = (file: File) => {
    if (!canCapture) {
      alert('请先选择要关联的学生');
      return;
    }
    onCapture(file, mode, role === 'parent' ? selectedStudentId : undefined);
  };

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        deliverFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleAlbumPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) deliverFile(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* 顶栏 */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 模式切换 */}
        <div className="flex rounded-xl border-2 border-white/30 bg-black/40 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMode('wrong')}
            className={`rounded-lg px-4 py-1.5 text-sm transition-all ${
              mode === 'wrong' ? 'bg-[#7CB342] text-white' : 'text-white/80'
            }`}
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            错题
          </button>
          <button
            type="button"
            onClick={() => setMode('grading')}
            className={`rounded-lg px-4 py-1.5 text-sm transition-all ${
              mode === 'grading' ? 'bg-[#FFB74D] text-[#5D4037]' : 'text-white/80'
            }`}
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            批改
          </button>
        </div>

        <button
          type="button"
          onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="切换摄像头"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      {/* 家长选学生 */}
      {role === 'parent' && students.length > 0 && (
        <div className="relative z-10 mx-4 mb-2 rounded-xl border-2 border-white/20 bg-black/50 p-3 backdrop-blur-sm">
          <StudentPicker
            students={students}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            label="关联学生"
          />
        </div>
      )}

      {/* 取景 */}
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
            <p style={{ fontFamily: "'Patrick Hand', cursive" }}>{cameraError}</p>
            <button
              type="button"
              className="rounded-lg border-2 border-white/40 px-4 py-2 text-sm text-white"
              onClick={() => albumRef.current?.click()}
            >
              从相册选择
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                正在打开相机...
              </div>
            )}
          </>
        )}

        {/* 模式提示 */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span
            className="inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white backdrop-blur-sm"
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            {mode === 'wrong' ? '📕 框选错题收录' : '✏️ 整页作业批改'}
          </span>
        </div>
      </div>

      {/* 底部控制 */}
      <div className="relative z-10 flex items-center justify-between px-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {/* 相册 */}
        <button
          type="button"
          onClick={() => albumRef.current?.click()}
          className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white/40 bg-black/40 text-white backdrop-blur-sm"
          aria-label="从相册选择"
        >
          <ImageIcon className="h-6 w-6" />
        </button>
        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAlbumPick}
        />

        {/* 快门 */}
        <button
          type="button"
          onClick={handleShutter}
          disabled={!!cameraError || starting || !canCapture}
          className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-40"
          aria-label="拍照"
        >
          <span className="block h-[3.5rem] w-[3.5rem] rounded-full bg-white" />
        </button>

        {/* 占位保持对称 */}
        <div className="h-12 w-12" />
      </div>
    </div>
  );
}
