#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:3000';

async function main() {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  const steps = [
    { method: 'GET', path: '/api/view/town' },
    { method: 'GET', path: '/api/view/inn' },
    { method: 'GET', path: '/api/view/bank' },
    {
      method: 'POST',
      path: '/api/announce',
      body: { text: `Smoke test announcement @ ${new Date().toISOString()}` },
    },
  ];

  let hasError = false;

  for (const step of steps) {
    const url = new URL(step.path, baseUrl).toString();
    process.stdout.write(`${step.method} ${url} ... `);
    try {
      const response = await fetch(url, buildOptions(step));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await response.json().catch(() => null);
      console.log('ok');
    } catch (error) {
      hasError = true;
      console.log('failed');
      console.error(error);
    }
  }

  process.exitCode = hasError ? 1 : 0;
}

function buildOptions(step) {
  const options = { method: step.method, headers: {} };
  if (step.body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(step.body);
  }
  return options;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
