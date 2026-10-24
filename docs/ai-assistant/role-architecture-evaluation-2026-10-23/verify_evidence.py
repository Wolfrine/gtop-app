"""Read-only offline archive verification. Does not import or execute harnesses."""
import argparse,hashlib,json,math,pathlib,re,statistics,subprocess
from fractions import Fraction

ROOT=pathlib.Path(__file__).resolve().parent
def require(value,message):
    if not value:raise AssertionError(message)
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
def relative(root,name):
    path=(root/name).resolve()
    require(path.is_relative_to(root.resolve()),'Path outside evidence root: '+name)
    return path
def check_schema(value,schema):
    types=schema.get('type',[]);types=[types] if isinstance(types,str) else types
    matches={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),'number':type(value) in [int,float],'integer':type(value) is int,'null':value is None,'boolean':type(value) is bool}
    require(not types or any(matches[t] for t in types),'Schema type mismatch')
    if 'enum' in schema:require(value in schema['enum'],'Schema enum mismatch')
    if isinstance(value,dict):
        require(set(schema.get('required',[]))<=set(value),'Missing schema fields')
        properties=schema.get('properties',{})
        if schema.get('additionalProperties') is False:require(set(value)<=set(properties),'Unexpected schema fields')
        for k,s in properties.items():
            if k in value:check_schema(value[k],s)
    if isinstance(value,list) and 'items' in schema:
        for item in value:check_schema(item,schema['items'])
def transcript(packet):
    events=packet['relevant_conversation_history']+[packet['original_user_request']]
    require(len({e['id'] for e in events})==len(events),'Duplicate transcript IDs')
    for e in events:require(sha(e['text_verbatim'].encode('utf-8'))==e['sha256_utf8'],'Verbatim request hash differs')
    return {e['id'] for e in events}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--local-root',type=pathlib.Path);parser.add_argument('--git-index',action='store_true');args=parser.parse_args()
    manifest=read(ROOT/'evidence-manifest.json')
    require(len({f['path'] for f in manifest['files']})==len(manifest['files']),'Duplicate manifest paths')
    repo=ROOT.parents[2]
    for f in manifest['files']:
        p=relative(ROOT,f['path']);data=p.read_bytes()
        require(len(data)==f['bytes'] and sha(data)==f['sha256'],'Archive checksum differs: '+f['path'])
        if args.local_root and 'source_relative_to_local_root' in f:
            original=relative(args.local_root,f['source_relative_to_local_root']).read_bytes()
            require(data==original,'Original source differs: '+f['path'])
        if args.git_index:
            name=p.relative_to(repo).as_posix();blob=subprocess.run(['git','show',':'+name],cwd=repo,capture_output=True,check=True).stdout
            require(sha(blob)==f['sha256'],'Git index alters archived bytes: '+name)
        if p.suffix=='.json':read(p)
        if p.suffix=='.jsonl':
            for line in p.read_text(encoding='utf-8').splitlines():json.loads(line)
    records=[json.loads(line) for line in (ROOT/'captured-local-turns.jsonl').read_text(encoding='utf-8').splitlines()]
    index={(r['variant'],r['id']):r for r in records}
    require(len(index)==len(records)==90,'Local attempt count/IDs differ')
    for r in records:
        request=r['request'];require(request['model']=='qwen3.5:4b-q4_K_M' and request['options']['num_ctx']==8192,'Local model/context differs')
        require(bool('response' in r)^bool('failure' in r),'Ambiguous attempt outcome')
        for source in r['captured_files']:
            require(sha(canonical(r[source['field']]))==source['canonical_json_sha256'],'Captured JSON value altered')
            if args.local_root:
                p=relative(args.local_root,source['source_relative_to_local_root'])
                require(sha(p.read_bytes())==source['source_sha256'] and read(p)==r[source['field']],'Captured original differs')
        if 'response' in r:
            response=r['response'];check_schema(response['result'],request['format'])
            require(json.loads(response['raw_content'])==response['result'],'Raw local output/result differ')
            t=response['timing'];require(0<=t['load_s']<=t['wall_s']+0.2 and 0<=t['first_content_s']<=t['wall_s'],'Invalid local timing')
        else:
            require(r['id']=='hi-teacher-1' and r['variant']=='local','Unexpected failed attempt')
            try:json.loads(r['failure']['partial_content'])
            except json.JSONDecodeError:pass
            else:raise AssertionError('Expected truncated JSON failure not present')
    metrics=read(ROOT/'metrics.json')
    require(metrics['captured_local_attempts']==90 and metrics['local_valid_responses']==89 and metrics['local_failed_attempts']==1,'Attempt metrics differ')
    for name,key,variant,expected_routes in [('local-evaluation.json','baseline','local',12),('local-evaluation-v2.json','v2','local-v2',31)]:
        rows=read(ROOT/name);require(len(rows)==36,'Dialogue count differs')
        for r in rows:
            captured=index[(variant,r['id'])]
            if r.get('result') is not None:
                require(r['result']==captured['response']['result'] and r['timing']==captured['response']['timing'],'Dialogue association differs')
                require(r['checks']['route']==(r['result']['route']==r['expected_route']),'Route score differs')
            else:require('failure' in captured,'Unlinked failure')
        require(sum(r['checks']['route'] for r in rows)==expected_routes==metrics[key]['route_pass'],'Route total differs')
        warm=[r['timing'] for r in rows if 'timing' in r and r['timing']['load_s']<1];values=sorted(t['wall_s'] for t in warm);m=metrics[key]['latency']
        require(m['warm_n']==len(values) and m['wall_p50_seconds']==round(statistics.median(values),5) and m['wall_p95_nearest_rank_seconds']==values[math.ceil(.95*len(values))-1] and m['first_streamed_content_p50_seconds']==round(statistics.median(t['first_content_s'] for t in warm),5),'Latency aggregation differs')
    context=read(ROOT/'context-selection-and-holdout.json');require(len(context)==15,'Selected-context/holdout count differs')
    for r in context:
        captured=index[('local-v2',r['id'])]['response'];require(r['response']==captured['result'] and r['timing']==captured['timing'] and r['cloud_calls']==0,'Context/holdout association differs')
    require(sum(r['response']['route']==r.get('expected_route') for r in context if r['type']=='fresh_dialogue_small_holdout')==metrics['holdout_route_pass']==9,'Holdout routes differ')
    audit=read(ROOT/'manual-audit.json')
    for a in audit['selected_observations']:require(a['actual_reply']==index[(a['variant'],a['id'])]['response']['result']['reply'],'Manual quote differs')
    for a in audit['targeted_status']+audit['holdout']:require(a['reply']==index[('local-v2',a['id'])]['response']['result']['reply'],'Manual context quote differs')
    cases={c['id']:c for c in read(ROOT/'handoff-cases.json')};require(len(cases)==8,'Handoff case count differs')
    for c in cases.values():transcript(c['rich'])
    handoffs=read(ROOT/'handoff-results.json');require(len(handoffs)==20,'Handoff decision count differs')
    expected_batches={'brief-only':(1,8),'rich':(7,8),'rich-reversed-repeat':(2,2),'brief-reversed-repeat':(0,2)}
    for row in handoffs:
        c=cases[row['case_id']];d=row['decision'];require(d['case_id']==row['case_id'],'Decision ID mismatch')
        checks={'next_action':d['next_action']==c['expected_action']};checks.update({key:d['requirements'][key]==value for key,value in c['expected_requirements'].items()})
        if row['arm']=='rich':checks['cites_original_evidence']=bool(d['evidence_event_ids']) and set(d['evidence_event_ids'])<=transcript(c['rich'])
        require(checks==row['checks'] and all(checks.values())==row['passed'],'Handoff strict score differs')
        source=read(ROOT/'codex'/row['batch']/'result.json');require(d==next(v for v in source['decisions'] if v['case_id']==row['case_id']),'Codex decision association differs')
    for label,(passed,total) in expected_batches.items():
        rows=[r for r in handoffs if r['batch']==label];m=next(v for v in metrics['handoff_batches'] if v['batch']==label)
        require((sum(r['passed'] for r in rows),len(rows))==(passed,total)==(m['strict_pass'],m['case_decisions']),'Batch metrics differ')
    require(len(metrics['codex_runs'])==5,'Cloud call count differs')
    for run in metrics['codex_runs']:
        folder=ROOT/'codex'/run['id'];summary=read(folder/'execution.json');result=read(folder/'result.json');events=[json.loads(x) for x in (folder/'events.jsonl').read_text(encoding='utf-8').splitlines()]
        require({k:v for k,v in run.items() if k!='id'}==summary,'CLI metrics source differs')
        require(summary['completed'] and not summary['failed'] and summary['exit_code']==0 and summary['tools_called']==0,'CLI outcome differs')
        require(any(e.get('type')=='turn.completed' for e in events) and not any(e.get('type') in ['error','turn.failed'] for e in events),'CLI final events differ')
        require(not any(e.get('item',{}).get('type') in ['command_execution','mcp_tool_call','web_search','file_change'] for e in events),'Unexpected tool event')
        final=[e['item']['text'] for e in events if e.get('type')=='item.completed' and e.get('item',{}).get('type')=='agent_message'][-1]
        require(json.loads(final)==result,'CLI final/result differ');check_schema(result,read(folder/'output-schema.json'))
    packet=read(ROOT/'execution-handoff.json');transcript(packet)
    require(packet['local_llm_interpretation_and_proposed_actions']==index[('local-v2','execution-interpretation')]['response']['result'],'Actual local handoff differs')
    require(json.loads((ROOT/'codex/real-worked-review/input.txt').read_text(encoding='utf-8').split('DATA:\n',1)[1])==packet,'Actual CLI packet differs')
    result=read(ROOT/'codex/real-worked-review/result.json');validation=read(ROOT/'execution-validation.json')
    resistance=Fraction(6)+1/(1/Fraction(12)+1/Fraction(6));current=Fraction(24)/resistance;parallel=Fraction(24)-current*6
    expected={'equivalent_resistance_ohm':float(resistance),'total_current_amp':float(current),'parallel_12ohm_current_amp':float(parallel/12),'parallel_6ohm_current_amp':float(parallel/6),'energy_300s_joule':float(24*current*300)}
    require(expected==validation['independent_fraction_calculation'] and validation['passed'] and all(validation['checks'].values()),'Saved numeric validation differs')
    require(all(type(result[k]) in [int,float] and abs(result[k]-v)<1e-8 for k,v in expected.items()),'Independent arithmetic differs')
    offline=read(ROOT/'offline-fixture-result.json');require(all(offline[k] is True for k in ['connection_refused_observed','queued_after_reopen','cross_owner_denied']),'Offline fixture differs')
    require('Ran 4 tests' in (ROOT/'controller-tests.txt').read_text(encoding='utf-8-sig') and '\nOK' in (ROOT/'controller-tests.txt').read_text(encoding='utf-8-sig'),'Controller test record missing')
    for doc in ROOT.glob('*.md'):
        for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)',doc.read_text(encoding='utf-8')):
            if '://' not in link and not link.startswith('#'):require((doc.parent/link.split('#',1)[0]).exists(),'Broken local documentation link: '+link)
    print(json.dumps({'verified':True,'archived_files':len(manifest['files']),'local_attempts':90,'valid_local_responses':89,'codex_calls':5,'handoff_decisions':20,'independent_numeric_checks':True,'original_sources_checked':bool(args.local_root),'git_index_checked':args.git_index,'scope':'Saved evidence only; no inference or network call.'}))

if __name__=='__main__':main()
