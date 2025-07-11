const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'assets', 'syllabus');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');

const index = [];
for (const file of files) {
  const m = /^([^-]+)-(\d+)\.json$/.exec(file);
  if (m) {
    const [_, board, standard] = m;
    index.push({ board: board.toUpperCase(), standard, file: `assets/syllabus/${file}` });
  }
}

index.sort((a,b) => a.board.localeCompare(b.board) || Number(a.standard) - Number(b.standard));
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));

