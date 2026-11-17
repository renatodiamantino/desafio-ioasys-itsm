import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const ALLOWED_FILES = new Set(['status.html', 'banco.html', 'mapping.html']);

export async function GET(
  _req: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!ALLOWED_FILES.has(file)) {
    return new NextResponse('Arquivo não encontrado.', { status: 404 });
  }

  const candidates = [
    path.resolve(process.cwd(), '../../Control', file),
    path.resolve(process.cwd(), 'Control', file),
  ];

  for (const filePath of candidates) {
    try {
      const html = await readFile(filePath, 'utf-8');
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      // tenta próximo caminho
    }
  }

  return new NextResponse('Painel HTML não encontrado em Control/.', { status: 404 });
}
