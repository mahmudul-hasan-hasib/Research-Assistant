import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

function detectFileType(filename: string): 'image' | 'document' | 'video' | 'text' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
  return 'text';
}

async function extractPdfText(filepath: string): Promise<string> {
  // pdf2json uses pdfjs-dist internally but handles the worker setup itself.
  // We wrap the event-based API in a promise.
  // Note: pdf2json prints warnings to stderr ("Setting up fake worker", "Unsupported: field.type of Link").
  // These are harmless — the text extraction works correctly.
  const { default: PDFParser } = await import('pdf2json');

  return new Promise((resolve, reject) => {
    const parser = new (PDFParser as any)(null, 1);
    
    parser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        const text = pdfData.Pages.map((page: any) =>
          page.Texts.map((textObj: any) =>
            textObj.R.map((run: any) => decodeURIComponent(run.T)).join('')
          ).join(' ')
        ).join('\n');
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });

    parser.on('pdfParser_dataError', (err: any) => {
      reject(new Error(err?.parserError || err?.message || 'PDF parsing failed'));
    });

    parser.loadPDF(filepath);
  });
}

async function extractText(filepath: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Plain text files — read directly
  if (['txt', 'md', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h'].includes(ext)) {
    return await readFile(filepath, 'utf-8');
  }

  // PDF
  if (ext === 'pdf') {
    try {
      return await extractPdfText(filepath);
    } catch (err: any) {
      console.error('PDF parse error:', err.message);
      return `[Could not extract text from PDF: ${err.message}]`;
    }
  }

  // DOCX
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const buf = await readFile(filepath);
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value || '';
    } catch (err: any) {
      console.error('DOCX parse error:', err.message);
      return `[Could not extract text from DOCX: ${err.message}]`;
    }
  }

  // .doc (old format)
  if (ext === 'doc') {
    return '[Old .doc format is not supported. Please convert to .docx or .pdf and re-upload.]';
  }

  // Image
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    return '';
  }

  // Video
  if (['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(ext)) {
    return '[Video file uploaded. Video analysis is not yet supported.]';
  }

  // Fallback
  try {
    return await readFile(filepath, 'utf-8');
  } catch {
    return '[Unable to extract text from this file.]';
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const id = randomUUID();
    const savedName = `${id}-${file.name}`;
    const filepath = join(UPLOAD_DIR, savedName);

    // Save file to disk temporarily
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const fileType = detectFileType(file.name);

    // Extract text content from documents
    const textContent = await extractText(filepath, file.name);

    // For images, get base64
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    if (fileType === 'image') {
      const buf = await readFile(filepath);
      imageBase64 = buf.toString('base64');
      const ext = file.name.split('.').pop() || '';
      imageMimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }

    // Clean up temp file
    try { await unlink(filepath); } catch {}

    return NextResponse.json({
      id,
      name: file.name,
      type: fileType,
      url: `/uploads/${savedName}`,
      size: file.size,
      textContent,
      imageBase64,
      imageMimeType,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
