"""Verify preserved Step 2 originals without network access or application changes."""
from pathlib import Path
import hashlib,json,struct,re

ROOT=Path(__file__).resolve().parent

def verify(root=ROOT):
    manifests=sorted((root/'evidence/baseline/2026-10-09').glob('*/manifest.json'))
    assert manifests,'No capture manifests found'
    originals=0
    for manifest in manifests:
        data=json.loads(manifest.read_text())
        entries=data['entries']
        ids=[e['id'] for e in entries]
        assert len(ids)==len(set(ids)),f'Duplicate capture IDs in {manifest}'
        for entry in entries:
            image=entry['image'];p=root/image['path'];raw=p.read_bytes()
            assert p.resolve().is_relative_to(root.resolve())
            assert raw[:8]==b'\x89PNG\r\n\x1a\n',p
            assert len(raw)==image['bytes'],p
            assert hashlib.sha256(raw).hexdigest()==image['sha256'],p
            assert struct.unpack('>II',raw[16:24])==(image['width'],image['height']),p
            assert entry['viewport']['width'] in (390,1440),entry['id']
            assert entry['sourceCommit']==data['sourceCommit'],entry['id']
            originals+=1
        live=manifest.parent/'live-public.json'
        if live.exists():
            for entry in json.loads(live.read_text()):
                im=entry['image'];raw=(root/im['path']).read_bytes()
                assert raw[:8]==b'\x89PNG\r\n\x1a\n',im['path']
                assert hashlib.sha256(raw).hexdigest()==im['sha256'],im['path']
                assert struct.unpack('>II',raw[16:24])==(im['width'],im['height']),im['path']
                if 'bytes' in im: assert len(raw)==im['bytes'],im['path']
                originals+=1
    coverage_path=root/'sitemap/coverage.json'
    if coverage_path.exists():
        coverage=json.loads(coverage_path.read_text())
        assert len(coverage['routes'])==40
        assert len(set(r['path'] for r in coverage['routes']))==39
        for row in coverage['routes']:
            for viewport in ('desktop','mobile'):
                for rel in row.get(viewport+'EvidencePaths',[]):assert (root/rel).exists(),rel
    catalog=json.loads((root/'screens/baseline-catalog.json').read_text())
    records={r['recordId']:r for r in catalog['records']}
    assert len(records)==catalog['recordCount']
    for record_id in catalog['latestByStateViewport'].values():
        record=records[record_id]
        assert record['auditEligible'] and record['selectedForAudit'],record_id
        assert record['visualStatus'].startswith('reviewed'),record_id
    for document in (root/'sitemap/gallery.md',root/'sitemap/README.md',root/'evidence/baseline/README.md',root/'evidence/baseline/review.md'):
        for target in re.findall(r'\]\(([^)]+)\)',document.read_text()):
            if target.startswith(('http:','https:','#')):continue
            path=(document.parent/target.split('#')[0]).resolve()
            assert path.exists(),f'{document}: missing link {target}'
    print(f'Verified {originals} PNG originals across {len(manifests)} capture runs.')

if __name__=='__main__':verify()
