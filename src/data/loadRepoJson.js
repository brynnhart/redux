import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadRepoJson(fileName, moduleUrl) {
    const fileUrl = new URL(`../../data/${fileName}`, moduleUrl);
    return JSON.parse(readFileSync(fileURLToPath(fileUrl), 'utf-8'));
}
