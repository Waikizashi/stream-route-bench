import { download } from './download.js';

export const DEFAULT_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
export const REQUEST_COUNT = 10;

function linesOf(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());

  if (lines[0] !== '#EXTM3U') {
    throw new Error('По указанному адресу не найден HLS-плейлист.');
  }

  return lines;
}

function parseVariants(lines, baseUrl) {
  const variants = [];
  let height;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      height = Number(line.match(/\bRESOLUTION=\d+x(\d+)/)?.[1]);
    } else if (line && !line.startsWith('#') && height) {
      variants.push({ height, url: new URL(line, baseUrl).href });
      height = undefined;
    }
  }

  return variants;
}

function parseSegments(lines, baseUrl) {
  const urls = [];

  for (const line of lines) {
    if (/^#EXT-X-(MAP|BYTERANGE|PART|DEFINE|SKIP):/.test(line)) {
      throw new Error('Поддерживаются полные самостоятельные MPEG-TS-сегменты.');
    }

    if (line.startsWith('#EXT-X-KEY:') && !/\bMETHOD=NONE(?:,|$)/.test(line)) {
      throw new Error('Зашифрованные видеопотоки не поддерживаются.');
    }

    if (line && !line.startsWith('#')) {
      urls.push(new URL(line, baseUrl).href);
    }
  }

  if (urls.length < REQUEST_COUNT) {
    throw new Error(`В плейлисте должно быть минимум ${REQUEST_COUNT} полных сегментов.`);
  }

  return urls.slice(0, REQUEST_COUNT);
}

export async function prepareStream(url) {
  const master = await download(url, { text: true });
  const lines = linesOf(master.text);

  if (!lines.some((line) => line.startsWith('#EXT-X-STREAM-INF:'))) {
    return [{ quality: 'Видео', urls: parseSegments(lines, master.url), video: true }];
  }

  const variants = parseVariants(lines, master.url);
  const plan = [];

  for (const height of [480, 1080]) {
    const variant = variants.find((item) => item.height === height);

    if (!variant) {
      throw new Error(`В потоке отсутствует качество ${height}p.`);
    }

    const playlist = await download(variant.url, { text: true });

    plan.push({
      quality: `${height}p`,
      urls: parseSegments(linesOf(playlist.text), playlist.url),
      video: true,
    });
  }

  return plan;
}
