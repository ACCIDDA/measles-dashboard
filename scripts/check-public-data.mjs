#!/usr/bin/env node
// Vite copies public/ verbatim, including ignored files. Stop a stale local
// dataset from being bundled into the dashboard or served by the dev server.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function assertNoLocalCsv(directory) {
  const files = [];
  function walk(path, relative = '') {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const name = join(relative, entry.name);
      if (entry.isDirectory()) walk(join(path, entry.name), name);
      else if (/\.csv$/i.test(entry.name)) files.push(name);
    }
  }
  walk(directory);
  if (files.length) {
    throw new Error(`Local CSV datasets must not be published by the dashboard. Remove these files from public/ before building:\n${files.sort().join('\n')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertNoLocalCsv(join(dirname(fileURLToPath(import.meta.url)), '../public'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
