"""Verify the design record's imported bytes and internal links; no network or app mutation."""
from pathlib import Path
import hashlib,json,re,struct

root=Path(__file__).resolve().parent
manifest=json.loads((root/'evidence/readiness/import-manifest.json').read_text())
for entry in manifest['files']:
 path=(root/entry['path']).resolve()
 assert path.is_relative_to(root),entry['path']
 data=path.read_bytes()
 assert len(data)==entry['bytes'],str(path)
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],str(path)
catalog=json.loads((root/'screens/catalog.json').read_text())['captures']
assert len(catalog)==53 and len({x['captureId'] for x in catalog})==53
for entry in catalog:
 raw=(root/entry['path']).read_bytes()
 assert raw[:8]==b'\x89PNG\r\n\x1a\n'
 w,h=struct.unpack('>II',raw[16:24])
 assert entry['imageDimensions']=={'width':w,'height':h}
 assert hashlib.sha256(raw).hexdigest()==entry['sha256']
for run,expected,unexpected in [('initial',10,2),('followup',0,2),('final',2,0)]:
 stats=json.loads((root/f'evidence/readiness/runs/{run}/tests.json').read_text())['stats']
 assert stats['expected']==expected and stats['unexpected']==unexpected,(run,stats)
for md in root.rglob('*.md'):
 if 'runs' in md.parts:continue
 for link in re.findall(r'\]\(([^)]+)\)',md.read_text()):
  if re.match(r'https?://|#',link):continue
  target=(md.parent/link.split('#')[0]).resolve()
  if target.is_relative_to(root):assert target.exists(),f'{md}: {link}'
status=json.loads((root/'status.json').read_text())
assert status['readinessCaptureCount']==len(catalog)
assert status['gtopScreensRated']==0 and status['mockupsAccepted']==0
print(f'Verified {len(manifest["files"])} imported files, {len(catalog)} PNG originals, three test-result sets and local document links.')
