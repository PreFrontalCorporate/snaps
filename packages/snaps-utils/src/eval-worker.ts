// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - TypeScript complains about this being ESM in a CJS file, but
// `ses/lockdown` has a CommonJS entry point.
// eslint-disable-next-line import-x/no-unassigned-import
import 'ses/lockdown';

import { readFileSync } from 'fs';

import type { HandlerType } from './handlers';
import { SNAP_EXPORT_NAMES } from './handlers';
import { generateMockEndowments } from './mock';

declare let lockdown: any, Compartment: any;

lockdown({
  errorTaming: 'unsafe',
  stackFiltering: 'verbose',
  overrideTaming: 'severe',
  localeTaming: 'unsafe',

  // We disable domain taming, because it does not work in certain cases when
  // running tests. This is unlikely to be a problem in production, because
  // Node.js domains are deprecated.
  domainTaming: 'unsafe',
});

const snapFilePath = process.argv[2];

const snapModule: { exports?: any } = { exports: {} };

const compartment = new Compartment({
  ...generateMockEndowments(),
  module: snapModule,
  exports: snapModule.exports,
});

// Mirror BaseSnapExecutor
compartment.globalThis.self = compartment.globalThis;
compartment.globalThis.global = compartment.globalThis;
compartment.globalThis.window = compartment.globalThis;

compartment.evaluate(readFileSync(snapFilePath, 'utf8'));

const invalidExports = Object.keys(snapModule.exports).filter(
  (snapExport) => !SNAP_EXPORT_NAMES.includes(snapExport as HandlerType),
);

if (invalidExports.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`Invalid snap exports detected:\n${invalidExports.join('\n')}`);
}

// To ensure the worker exits we explicitly call exit here
// If we didn't the eval would wait for timers set during Compartment eval
process.exit(0);
