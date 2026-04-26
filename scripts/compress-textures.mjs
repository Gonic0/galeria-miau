import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const artworksDir = join(root, '..', 'public', 'artworks');

const files = (await readdir(artworksDir)).filter((f) => extname(f).toLowerCase() === '.png');

let savedBytes = 0;
for (const file of files) {
  const inputPath = join(artworksDir, file);
  const outputPath = join(artworksDir, basename(file, '.png') + '.webp');

  const input = await stat(inputPath);
  await sharp(inputPath)
    .resize({ width: 1536, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(outputPath);
  const output = await stat(outputPath);

  const saved = input.size - output.size;
  savedBytes += saved;
  console.log(
    `${file} → ${basename(outputPath)}: ${(input.size / 1024 / 1024).toFixed(2)} MB → ${(output.size / 1024 / 1024).toFixed(2)} MB (-${((saved / input.size) * 100).toFixed(0)}%)`
  );
}
console.log(`\nTotal saved: ${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
