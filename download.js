import { performance } from 'node:perf_hooks';

export async function download(url, { text = false, video = false } = {}) {
  const startedAt = performance.now();
  const chunks = [];
  let bytes = 0;

  try {
    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'identity' },
      signal: AbortSignal.timeout(120_000),
    });

    for await (const chunk of response.body ?? []) {
      bytes += chunk.byteLength;

      if (text) {
        if (bytes > 2 * 1024 * 1024) {
          throw new Error('Плейлист превышает 2 МиБ.');
        }

        chunks.push(chunk);
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (video) {
      const contentType = response.headers.get('content-type') ?? '';

      if (bytes === 0) {
        throw new Error('Получен пустой видеосегмент.');
      }

      if (!/^(video\/|audio\/|application\/octet-stream)/i.test(contentType)) {
        throw new Error('Вместо видеосегмента получен другой тип данных.');
      }
    }

    return {
      bytes,
      durationMs: performance.now() - startedAt,
      url: response.url,
      ...(text ? { text: Buffer.concat(chunks).toString('utf8') } : {}),
    };
  } catch (error) {
    throw Object.assign(new Error(error.message), {
      bytes,
      durationMs: performance.now() - startedAt,
    });
  }
}
