const BYTES_PER_MIB = 1024 * 1024;
const round = (value) => Number(value.toFixed(2));
const mib = (bytes) => bytes / BYTES_PER_MIB;
const speed = (bytes, durationMs) => mib(bytes) / (durationMs / 1000);

export function printHeading(title) {
  const heading = process.stdout.isTTY ? `\x1b[1;36m${title}\x1b[0m` : title;
  console.log(`\n${heading}\n`);
}

export function printRequests({ samples }) {
  const hasErrors = samples.some((sample) => sample.error);

  console.table(
    samples.map((sample, index) => ({
      '№': index + 1,
      Статус: sample.error ? 'Ошибка' : 'ОК',
      'Время, мс': round(sample.durationMs),
      'Объём, МиБ': round(mib(sample.bytes)),
      'Скорость, МиБ/с': sample.error ? '—' : round(speed(sample.bytes, sample.durationMs)),
      Завершение: index === 0 ? 'первый' : index === samples.length - 1 ? 'последний' : '',
      ...(hasErrors ? { Ошибка: sample.error ?? '' } : {}),
    })),
  );
}

function summarize(quality, samples) {
  const bytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
  const durationMs = samples.reduce((sum, sample) => sum + sample.durationMs, 0);
  const successful = samples.filter((sample) => !sample.error).length;

  return {
    Качество: quality,
    Успешно: `${successful}/${samples.length}`,
    'Среднее, мс': round(durationMs / samples.length),
    'Объём, МиБ': round(mib(bytes)),
    'Время серии, с': round(durationMs / 1000),
    'Скорость, МиБ/с': round(speed(bytes, durationMs)),
  };
}

export function printSummary(batches) {
  printHeading('ИТОГИ');

  const rows = batches.map(({ quality, samples }) => summarize(quality, samples));

  if (batches.length > 1) {
    rows.push(
      summarize(
        'ИТОГО',
        batches.flatMap((batch) => batch.samples),
      ),
    );
  }

  console.table(rows);
}
