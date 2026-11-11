import { StaqOnApiError } from './api/client.js';

export function ok(message: string): void {
  console.log(message);
}

export function fail(e: unknown): never {
  if (e instanceof StaqOnApiError) {
    console.error(`Error: ${e.message}`);
    if (Object.keys(e.body).length) {
      const extra = Object.fromEntries(Object.entries(e.body).filter(([k]) => k !== 'error' && k !== 'ok'));
      if (Object.keys(extra).length) console.error(JSON.stringify(extra, null, 2));
    }
  } else if (e instanceof Error) {
    console.error(`Error: ${e.message}`);
  } else {
    console.error('Error:', e);
  }
  process.exit(1);
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
