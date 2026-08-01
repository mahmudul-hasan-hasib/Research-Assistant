'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, FileText, Video, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInsightStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const fileTypes = {
  image: { icon: <ImageIcon className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  document: { icon: <FileText className="h-3.5 w-3.5" />, color: 'text-violet-600', bg: 'bg-violet-50' },
  video: { icon: <Video className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
  text: { icon: <File className="h-3.5 w-3.5" />, color: 'text-sky-600', bg: 'bg-sky-50' },
};

export function FileUpload() {
  const { uploadedFiles, addUploadedFile, removeUploadedFile, clearUploadedFiles } = useInsightStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        console.error('Upload error:', data.error);
        return;
      }
      addUploadedFile({
        id: data.id,
        name: data.name,
        type: data.type,
        url: data.url,
        size: data.size,
        textContent: data.textContent || undefined,
        imageBase64: data.imageBase64 || undefined,
        imageMimeType: data.imageMimeType || undefined,
      });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [addUploadedFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleFile);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(handleFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {uploadedFiles.map((f) => {
              const ft = fileTypes[f.type];
              return (
                <motion.div
                  key={f.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 border',
                    ft.bg
                  )}
                >
                  <span className={ft.color}>{ft.icon}</span>
                  <span className="text-xs max-w-[120px] truncate">{f.name}</span>
                  <button
                    onClick={() => removeUploadedFile(f.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearUploadedFiles}
            >
              Clear all
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-dashed border-border/60 hover:border-emerald-300 hover:bg-emerald-50/30',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <Upload className={cn('h-4 w-4 shrink-0', isDragging ? 'text-emerald-600' : 'text-muted-foreground')} />
        <span className="text-xs text-muted-foreground">
          {isUploading ? 'Uploading...' : isDragging ? 'Drop files here' : 'Upload images, PDFs, or videos'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.txt,.md,.doc,.docx,.csv,.mp4,.avi,.mov,.webm"
          multiple
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}
