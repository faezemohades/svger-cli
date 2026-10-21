const runButton = document.querySelector('#run-benchmark');
const countSelect = document.querySelector('#fixture-count');
const status = document.querySelector('#benchmark-status');
const resultsRegion = document.querySelector('#benchmark-results');
const downloadLink = document.querySelector('#download-report');
const companion = 'http://127.0.0.1:4317';

const formatMs = value => `${Number(value).toFixed(1)} ms`;
const formatMiB = bytes => `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MiB`;
const formatPercent = value => `${(Number(value) * 100).toFixed(1)}% of one CPU core`;

function showResults(report) {
  resultsRegion.replaceChildren();
  const intro = document.createElement('p');
  intro.textContent = `${report.fixtureCount} deterministic SVG inputs · Node ${report.versions.node} · fixture SHA-256 ${report.fixturesSha256}`;
  resultsRegion.append(intro);

  const table = document.createElement('table');
  const header = document.createElement('tr');
  for (const value of ['Implementation', 'Version', 'Succeeded / failed', 'Wall time', 'Process CPU time', 'Peak sampled RSS', 'Output bytes', 'Output SHA-256']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = value;
    header.append(cell);
  }
  const head = document.createElement('thead');
  head.append(header);
  const body = document.createElement('tbody');
  for (const result of report.results) {
    const row = document.createElement('tr');
    const values = [
      result.engine === 'svger' ? 'SVGER-CLI' : 'SVGR',
      result.engineVersion,
      `${result.succeeded} / ${result.failed}`,
      formatMs(result.wallTimeMs),
      `${formatMs(result.cpuTimeMs)} (${formatPercent(result.cpuCoreEquivalent)})`,
      formatMiB(result.peakRssBytes),
      String(result.outputBytes),
      result.outputSha256,
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  resultsRegion.append(table);

  const measurementNotes = document.createElement('p');
  measurementNotes.textContent = `${report.methodology.cpu}. ${report.methodology.memory}.`;
  resultsRegion.append(measurementNotes);

  const [svger, svgr] = report.results;
  const outcome = document.createElement('p');
  if (svger.failed > 0 || svgr.failed > 0) {
    outcome.textContent = `At least one implementation failed to transform inputs (SVGER-CLI: ${svger.failed}; SVGR: ${svgr.failed}). Treat this run as a compatibility/failure observation; wall-time ranking is not meaningful.`;
  } else {
    const faster = svger.wallTimeMs === svgr.wallTimeMs
      ? 'Wall times tied at the reported precision.'
      : `${svger.wallTimeMs < svgr.wallTimeMs ? 'SVGER-CLI' : 'SVGR'} had lower wall time in this run.`;
    outcome.textContent = `${faster} This is one host-specific run, not a general performance claim.`;
  }
  outcome.textContent += ` Both engines used fixture digest ${report.fixturesSha256}.`;
  resultsRegion.append(outcome);
  resultsRegion.hidden = false;

  if (downloadLink.href.startsWith('blob:')) URL.revokeObjectURL(downloadLink.href);
  downloadLink.href = URL.createObjectURL(new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json' }));
  downloadLink.hidden = false;
}

runButton?.addEventListener('click', async () => {
  runButton.disabled = true;
  resultsRegion.hidden = true;
  downloadLink.hidden = true;
  status.textContent = 'Checking the local companion…';
  try {
    const health = await fetch(`${companion}/health`, { method: 'GET', mode: 'cors', cache: 'no-store' });
    const healthResult = await health.json();
    if (!health.ok || !healthResult.ready) {
      throw new Error('The companion is running, but the local build or benchmark dependencies are not ready. Follow the setup commands above.');
    }
    status.textContent = 'Running actual local transforms for both implementations. Keep this page open…';
    const response = await fetch(`${companion}/run`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: Number(countSelect.value) }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.message || report.error || 'Local benchmark failed.');
    showResults(report);
    status.textContent = 'Completed locally. No report was uploaded.';
  } catch (error) {
    status.textContent = error instanceof Error
      ? `${error.message} Ensure the companion is running at 127.0.0.1:4317 and that your browser permits this page to reach localhost.`
      : 'Unable to run the local comparison.';
  } finally {
    runButton.disabled = false;
  }
});
