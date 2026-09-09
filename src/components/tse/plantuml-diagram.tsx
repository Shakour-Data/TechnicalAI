'use client';

import { useMemo } from 'react';
import { useTheme } from '@/lib/theme-store';

interface PlantUMLDiagramProps {
  code: string;
  alt?: string;
}

/**
 * Renders a PlantUML diagram as an image using the public PlantUML server.
 * The diagram code is encoded and sent to plantuml.com for rendering.
 */
export default function PlantUMLDiagram({ code, alt }: PlantUMLDiagramProps) {
  const { isDark } = useTheme();

  const imageUrl = useMemo(() => {
    try {
      // PlantUML text encoding
      const trimmed = code.trim();
      // Add theme directive if dark mode
      const themedCode = isDark
        ? `!theme cloud\ntop to bottom direction\nskinparam backgroundColor #0f172a\nskinparam ArrowColor #64748b\nskinparam DefaultFontColor #e2e8f0\n${trimmed}`
        : trimmed;

      const encoded = encodePlantUML(themedCode);
      return `https://www.plantuml.com/plantuml/svg/${encoded}`;
    } catch {
      return null;
    }
  }, [code, isDark]);

  if (!imageUrl) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
        <p>⚠ امکان رمزگذاری دیاگرام PlantUML وجود ندارد</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <img
        src={imageUrl}
        alt={alt || 'PlantUML Diagram'}
        className="max-w-full h-auto"
        style={{ minHeight: '80px' }}
        loading="lazy"
      />
    </div>
  );
}

/**
 * PlantUML text encoding algorithm.
 * Uses deflate compression and custom Base64 encoding.
 */
function encodePlantUML(text: string): string {
  const data = new TextEncoder().encode(text);
  const compressed = deflate(data);
  return encode64(compressed);
}

function encode64(data: Uint8Array): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;
    result += chars[(b1 >> 2) & 0x3F];
    result += chars[((b1 << 4) | (b2 >> 4)) & 0x3F];
    if (i + 1 < data.length) result += chars[((b2 << 2) | (b3 >> 6)) & 0x3F];
    if (i + 2 < data.length) result += chars[b3 & 0x3F];
  }
  return result;
}

/** Minimal deflate implementation for PlantUML encoding */
function deflate(data: Uint8Array): Uint8Array {
  // Simple approach: use uncompressed deflate block
  // This is sufficient for PlantUML server-side rendering
  const output: number[] = [];

  // zlib header
  output.push(0x78, 0x01); // CM=8, CINFO=7, FCHECK=1

  let pos = 0;
  const len = data.length;

  while (pos < len) {
    const blockLen = Math.min(len - pos, 65535);
    const isLast = pos + blockLen >= len;

    // BFINAL + BTYPE=00 (no compression)
    output.push(isLast ? 0x01 : 0x00);
    // LEN
    output.push(blockLen & 0xFF);
    output.push((blockLen >> 8) & 0xFF);
    // NLEN
    output.push((~blockLen) & 0xFF);
    output.push((~blockLen >> 8) & 0xFF);
    // Data
    for (let i = 0; i < blockLen; i++) {
      output.push(data[pos + i]);
    }
    pos += blockLen;
  }

  // Adler32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  output.push((b >> 8) & 0xFF);
  output.push(b & 0xFF);
  output.push((a >> 8) & 0xFF);
  output.push(a & 0xFF);

  return new Uint8Array(output);
}
