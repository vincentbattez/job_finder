import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import { createRequestListener } from '@react-router/node';
import type { ServerBuild } from 'react-router';

// The browser's type of each file of the client build; anything else goes without one
const TYPE_BY_EXTENSION: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const BUILD_DIRECTORY = path.join(import.meta.dirname, '..', 'build', 'e2e');
const CLIENT_DIRECTORY = path.join(BUILD_DIRECTORY, 'client');
const PORT = Number(process.argv[2]);

// Imported by a path only known here: nothing is built yet when the typecheck or Knip reads this file
const listener = createRequestListener({
  build: (): Promise<ServerBuild> => import(path.join(BUILD_DIRECTORY, 'server', 'index.js')),
});

function readClientFile(pathname: string): string | null {
  const filePath = path.join(CLIENT_DIRECTORY, decodeURIComponent(pathname));
  const stat = statSync(filePath, { throwIfNoEntry: false });
  return filePath.startsWith(CLIENT_DIRECTORY) && stat?.isFile() === true ? filePath : null;
}

// The front of the e2e tests, built once rather than compiled page after page by the dev server: on
// the 2 vCPU runner that compilation is what stretched the tests and lost their clicks and toasts
createServer((request, response) => {
  const filePath = readClientFile(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (filePath === null) {
    listener(request, response);
    return;
  }
  response.writeHead(200, { 'Content-Type': TYPE_BY_EXTENSION[path.extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(PORT);
