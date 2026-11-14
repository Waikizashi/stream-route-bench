import { parseArgs } from 'node:util';
import { download } from './download.js';
import { DEFAULT_STREAM, prepareStream, REQUEST_COUNT } from './hls.js';
import { printHeading, printRequests, printSummary } from './report.js';

const HELP = `Замер скорости скачивания — Node.js 22+

  node index.js <URL>             10 последовательных загрузок файла
  node index.js --stream          Видео Mux: по 10 сегментов 480p и 1080p
  node index.js --stream <URL>    Свой HLS-плейлист
  node index.js --help            Справка

URL с расширением .m3u8 автоматически включает режим HLS.
`;

async function runBatch({ quality, urls, video }) {
  printHeading(`${quality} · ${urls.length} последовательных загрузок`);
  const samples = [];

  for (const [index, url] of urls.entries()) {
    if (process.stdout.isTTY) {
      process.stdout.write(`\rСкачивание: ${index + 1}/${urls.length}…`);
    }

    try {
      const result = await download(url, { video });
      samples.push(result);
    } catch (error) {
      samples.push({
        bytes: error.bytes,
        durationMs: error.durationMs,
        error: error.message,
      });
    }
  }

  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[2K');
  }

  const batch = { quality, samples };
  printRequests(batch);
  return batch;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      stream: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  if (positionals.length > 1 || (!positionals.length && !values.stream)) {
    throw new Error(HELP);
  }

  const url = new URL(positionals[0] ?? DEFAULT_STREAM);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Укажите адрес с протоколом HTTP или HTTPS.');
  }

  const stream = values.stream || url.pathname.toLowerCase().endsWith('.m3u8');
  let plan;

  if (stream) {
    console.log('Подготавливаю видеопоток…');
    plan = await prepareStream(url);
  } else {
    plan = [{ quality: 'Файл', urls: Array(REQUEST_COUNT).fill(url) }];
  }

  const batches = [];

  for (const item of plan) {
    batches.push(await runBatch(item));
  }

  printSummary(batches);

  if (batches.some((batch) => batch.samples.some((sample) => sample.error))) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
});
