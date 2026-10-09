"""Verify all registered reference originals, derived boards and local report links.
Run from any directory: python design-upgrade/references/capture-tools/verify.py
"""
import hashlib,json,re,struct
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'evidence-register.json').read_text())
items=[f for r in data['records'] for f in r['files']]+data['unfinalizedFiles']+data['derived']+json.loads((root/'live-browser-observations.json').read_text())
seen=set()
for f in items:
 p=root/f['path'];assert p.resolve().is_relative_to(root.resolve()),p
 b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==f['sha256'],p
 if p.suffix=='.png':assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(f['width'],f['height']),p
 elif p.suffix=='.jpg':
  with Image.open(p) as im:assert im.size==(f['width'],f['height']),p
 elif p.suffix=='.webm':assert b and len(b)==f['bytes'],p
 for source in f.get('sources',[]):assert (root/source).is_file(),source
 seen.add(p.resolve())
actual={p.resolve() for p in (root/'evidence').rglob('*') if p.suffix in ['.png','.jpg','.webm']}
assert actual<=seen,actual-seen
links=0
for md in root.rglob('*.md'):
 for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',md.read_text()):
  if '://' in target or target.startswith('#'):continue
  target=target.split('#')[0]
  assert (md.parent/target).exists(),f'{md}: {target}'
  links+=1
print(json.dumps({'integrity':'passed','registeredMediaFiles':len(items),'localMarkdownLinks':links,**data['counts']},indent=2))
