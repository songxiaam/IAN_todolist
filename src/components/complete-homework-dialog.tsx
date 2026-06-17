'use client';

import { useRef, useState } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HomeworkItem {
  id: number;
  title: string;
  points?: number;
}

interface CompleteHomeworkDialogProps {
  homework: HomeworkItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string;
  onCompleted: (result: { pointsAwarded: number; pointsBalance: number }) => void;
}

interface PreviewFile {
  file: File;
  url: string;
  type: 'image' | 'video';
}

export function CompleteHomeworkDialog({
  homework,
  open,
  onOpenChange,
  sessionToken,
  onCompleted,
}: CompleteHomeworkDialogProps) {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const previews: PreviewFile[] = selected.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));
    setFiles((prev) => [...prev, ...previews]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleComplete = async () => {
    if (!homework) return;
    setUploading(true);

    try {
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f.file));
        const uploadRes = await fetch(`/api/homework/${homework.id}/media`, {
          method: 'POST',
          headers: { 'x-session': sessionToken },
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error || '上传失败');
          setUploading(false);
          return;
        }
      }

      const completeRes = await fetch(`/api/homework/${homework.id}/complete`, {
        method: 'POST',
        headers: { 'x-session': sessionToken },
      });

      const data = await completeRes.json();
      if (!completeRes.ok) {
        alert(data.error || '完成失败');
        setUploading(false);
        return;
      }

      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      onOpenChange(false);
      onCompleted({
        pointsAwarded: data.pointsAwarded ?? 0,
        pointsBalance: data.pointsBalance ?? 0,
      });
    } catch {
      alert('操作失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    void handleComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#FFFDE7] border-2 border-[#5D4037] rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            📸 完成作业
          </DialogTitle>
        </DialogHeader>

        <p className="text-center text-[#8D6E63] text-sm" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          要拍照上传作业成果吗？可以上传多张照片或视频，也可以跳过
        </p>

        {homework && (homework.points ?? 0) > 0 && (
          <p className="text-center text-[#7CB342] text-sm mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            完成可获得 {homework.points} 积分（待家长审核）
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="grid grid-cols-2 gap-2 mt-4">
          {files.map((f, i) => (
            <div key={i} className="relative sketchy-border rounded-lg overflow-hidden aspect-square bg-[#F5E6D3]">
              {f.type === 'image' ? (
                <img src={f.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={f.url} className="w-full h-full object-cover" controls />
              )}
              <button
                className="absolute top-1 right-1 p-1 bg-[#EF5350] text-white rounded-full"
                onClick={() => removeFile(i)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button
            className="w-full py-3 crayon-button-orange text-[#5D4037] flex items-center justify-center gap-2"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-5 h-5" />
            拍照 / 选择文件
          </button>

          {files.length > 0 && (
            <button
              className="w-full py-3 border-2 border-[#D7CCC8] rounded-lg text-[#8D6E63] flex items-center justify-center gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="w-4 h-4" />
              继续添加
            </button>
          )}

          <div className="flex gap-3">
            <button
              className="flex-1 py-3 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg"
              onClick={handleSkip}
              disabled={uploading}
            >
              跳过
            </button>
            <button
              className="flex-1 py-3 crayon-button text-[#FFFDE7] disabled:opacity-50"
              onClick={handleComplete}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '完成 ✓'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
