"""Fail deployment unless reviewed live rules isolate OAuth state from Firebase clients."""
import hashlib
import json
import os
import pathlib
import urllib.request

headers = {'Authorization': 'Bearer ' + os.environ['ACCESS_TOKEN']}
def get(path):
    with urllib.request.urlopen(urllib.request.Request('https://firebaserules.googleapis.com/v1/' + path, headers=headers), timeout=30) as response:
        return json.load(response)
release = get('projects/gtop-app/releases/cloud.firestore')
rules = get(release['rulesetName'])
source = '\n'.join(file['content'] for file in rules['source']['files'])
expected = pathlib.Path('gtop-v2/firestore.rules').read_text()
if ''.join(source.split()) != ''.join(expected.split()):
    print('Deployed rules differ from reviewed repository rules. Review required before storing OAuth grants.')
    print('DEPLOYED_RULES_BEGIN\n' + source + '\nDEPLOYED_RULES_END')
    raise SystemExit(1)
print('Deployed Firestore rules deny client access to reserved OAuth storage.')
