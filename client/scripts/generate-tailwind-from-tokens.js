/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tokensPath = path.join(root, 'src/theme/tokens.json');
const targetPath = path.join(root, 'tailwind.generated.tokens.cjs');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

const output = `module.exports = ${JSON.stringify(
  {
    colors: tokens.colors,
    spacing: tokens.spacing,
    radius: tokens.radius,
    typography: tokens.typography,
  },
  null,
  2
)};\n`;

fs.writeFileSync(targetPath, output);
console.log(`Generated ${path.relative(root, targetPath)} from ${path.relative(root, tokensPath)}`);
