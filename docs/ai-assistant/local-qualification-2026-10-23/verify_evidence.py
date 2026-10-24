"""Read-only verification of this historical documentation package. No model calls."""
import argparse,collections,csv,hashlib,json,pathlib,re

ROOT=pathlib.Path(__file__).resolve().parent
def load(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def require(condition,message):
    if not condition:raise AssertionError(message)
def percentile(values,p):
    values=sorted(values);return round(values[int((len(values)-1)*p)],4)

def verify(local_root=None):
    manifest=load(ROOT/'evidence-manifest.json')
    for entry in manifest['files']:
        path=(ROOT/entry['repository_path']).resolve();require(path.is_relative_to(ROOT),'Escaping repository path')
        require(path.is_file(),'Missing '+str(path));require(sha(path)==entry['archive_sha256'],'Archive checksum differs: '+str(path))
        if local_root:
            source=(local_root/entry['source_relative_to_local_root']).resolve();require(source.is_relative_to(local_root),'Escaping local evidence root')
            require(sha(source)==entry['source_sha256'],'Original source checksum differs: '+str(source))
    local=ROOT/'local-requests.jsonl';require(sha(local)==manifest['local_requests_sha256'],'Local request archive checksum differs')
    requests=[json.loads(line) for line in local.read_text(encoding='utf-8').splitlines()]
    require(len(requests)==180 and len({r['id'] for r in requests})==180,'Request count/IDs differ')
    require(collections.Counter(r['group'] for r in requests)=={'benchmark':162,'selected-context-stress':6,'free-conversation':9,'paper-workflow':3},'Request coverage differs')
    schema=load(ROOT/'prompts/local-requirements-schema.json');system=(ROOT/'prompts/local-requirements-system.txt').read_text(encoding='utf-8')
    raw_cache={}
    for r in requests:
        if r['group']=='benchmark':
            source=raw_cache.setdefault(r['source'],[json.loads(line) for line in (ROOT/r['source']).read_text(encoding='utf-8').splitlines()])
            original=source[r['source_record_1_based']-1]
            require(r['response']==original['result'] and r['timing']==original['timing'],'Benchmark response/timing association differs')
            require(r['request']['messages'][0]['content']==system+'\nJSON schema: '+json.dumps(schema),'System/schema reconstruction differs')
    with (ROOT/'local-timings.csv').open(encoding='utf-8',newline='') as handle:rows=list(csv.DictReader(handle))
    require(len(rows)==180 and {r['id'] for r in rows}=={r['id'] for r in requests},'CSV coverage differs')
    for summary in load(ROOT/'benchmarks/comparison.json'):
        model=summary['model'];records=[r for r in requests if r['group']=='benchmark' and r['request']['model']==model]
        standard=[r for r in records if r['kind']=='standard'];require(len(records)==54 and len(standard)==36,'Model suite incomplete')
        require(sum(r['assessment']['passed'] for r in standard)==summary['standard_passed'],'Strict score differs')
        warm=[r for r in records if r['kind'] in ['standard','warm_repeat'] and r['timing']['load_s']<.1]
        require(percentile([r['timing']['wall_s'] for r in warm],.5)==summary['warm_wall_p50_s'],'Warm p50 differs')
        require(percentile([r['timing']['wall_s'] for r in warm],.95)==summary['warm_wall_p95_s'],'Warm p95 differs')
    runs=load(ROOT/'codex-runs.json');require(len(runs)==7,'Codex run index differs')
    for r in runs:
        execution=load(ROOT/r['execution']);require(execution['seconds']==r['seconds'],'Codex duration differs')
        require(execution['completed'] and execution['exit_code']==0 and execution['tools_called']==0,'Unexpected Codex execution result')
    totals=load(ROOT/'stage-timings.json')
    expected={'science':449.3196,'maths-standard':491.3026,'science-revision-q6':16.4162}
    for label,value in expected.items():
        d=load(ROOT/'jobs'/label/'dialogue.json');stages=[r for r in runs if r.get('subject')==label]
        actual=round(d['timing']['wall_s']+sum(r['seconds'] for r in stages),4)
        require(actual==value==totals[label]['measured_stage_sum_s'],'Timing sum differs: '+label)
    for path in ROOT.rglob('*.json'):load(path)
    for path in ROOT.rglob('*.md'):
        text=path.read_text(encoding='utf-8');require(text.count('```')%2==0,'Unbalanced fences: '+str(path))
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if '://' in target or target.startswith('#'):continue
            destination=(path.parent/target.split('#')[0]).resolve();require(destination.exists(),'Broken documentation link: '+target)
    print(json.dumps({'passed':True,'original_sources_verified':bool(local_root),'manifest_files':len(manifest['files']),'local_pairs':len(requests),'codex_runs':len(runs),'scope':'checksums, record associations, links, aggregate metrics and timing arithmetic; no inference or app checks'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--local-root',type=pathlib.Path);args=parser.parse_args();verify(args.local_root.resolve() if args.local_root else None)
