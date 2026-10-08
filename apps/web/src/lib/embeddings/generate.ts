import { pipeline } from '@xenova/transformers';

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const output = await pipe(text.slice(0, 512), {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}