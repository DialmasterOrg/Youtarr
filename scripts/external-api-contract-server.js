#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  SYNTHETIC_API_KEY,
  createExternalApiContractApp,
} = require('../server/testing/externalApiContractApp');

const contract = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../fixtures/external-api-v1/contract.json'),
  'utf8'
));
const scenario = process.env.YOUTARR_CONTRACT_SCENARIO || 'normal';
const delayMs = Number(process.env.YOUTARR_CONTRACT_DELAY_MS || 0);
const port = Number(process.env.YOUTARR_CONTRACT_PORT || 0);
const { app } = createExternalApiContractApp({ contract, scenario, delayMs });

const server = app.listen(port, '127.0.0.1', () => {
  const address = server.address();
  process.stdout.write(`${JSON.stringify({
    baseURL: `http://127.0.0.1:${address.port}`,
    apiKey: SYNTHETIC_API_KEY,
    scenario,
  })}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
