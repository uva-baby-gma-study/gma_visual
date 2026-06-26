const fs = require("fs");
const path = require("path");

const base = path.join(__dirname, "..", "output", "app_reconstructions");

const subjects = fs
  .readdirSync(base, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const outputPath = path.join(base, "index.json");
fs.writeFileSync(outputPath, JSON.stringify(subjects, null, 2) + "\n");

console.log(`Saved ${outputPath}:`, subjects);
