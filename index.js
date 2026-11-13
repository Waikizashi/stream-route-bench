import { performance } from 'node:perf_hooks';

const REQUEST_COUNT = 10;
const BYTES_PER_MIB = 1024 * 1024;

async function download(url) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  });

  let bytes = 0;

  for await (const chunk of response.body ?? []) {
    bytes += chunk.byteLength;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    bytes,
    durationMs: performance.now() - startedAt,
  };
}

async function main() {
  const [address, ...extraArguments] = process.argv.slice(2);

  if (!address || extraArguments.length > 0) {
    throw new Error('Использование: node index.js <URL>');
  }

  const url = new URL(address);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Укажите адрес с протоколом HTTP или HTTPS.');
  }

  let totalBytes = 0;
  let totalDurationMs = 0;

  for (let index = 0; index < REQUEST_COUNT; index += 1) {
    const result = await download(url);

    totalBytes += result.bytes;
    totalDurationMs += result.durationMs;
  }

  const averageDurationMs = totalDurationMs / REQUEST_COUNT;
  const totalMib = totalBytes / BYTES_PER_MIB;
  const speedMibPerSecond = totalMib / (totalDurationMs / 1000);

  console.log(`Среднее время запроса: ${averageDurationMs.toFixed(2)} мс`);
  console.log(`Общий объём: ${totalBytes} байт (${totalMib.toFixed(2)} МиБ)`);
  console.log(`Скорость скачивания: ${speedMibPerSecond.toFixed(2)} МиБ/с`);
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
});
