#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { researchSchool } from './research.mjs';

function usage() {
  console.error('Usage: node tools/outreach/research-school.mjs <school-seed.json>');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) usage();

const seed = JSON.parse(await readFile(inputPath, 'utf8'));
if (!seed.name || !seed.websiteUrl || seed.state !== 'GA') {
  throw new Error('Seed must include name, websiteUrl, and state="GA".');
}

const result = await researchSchool(seed);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

