"""Fail deployment unless reviewed live rules isolate OAuth state from Firebase clients."""
import re
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
# Inspect matches at the database root. Every non-default root match must
# begin with a literal collection name other than the reserved OAuth name.
# A recursive root fallback and direct database-level grants must deny access.
clean = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)
depth = 0
for token in re.finditer(r'match\s+([^\s]+)\s*\{|allow\s+[^;]+;|[{}]', clean):
    text = token.group(0)
    if text.startswith('match'):
        path = token.group(1)
        if depth == 2:
            if path == '/{document=**}':
                remaining = clean[token.end():]
                assert re.match(r'\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;\s*}', remaining), 'Default rule must deny all access'
            else:
                assert re.match(r'^/[A-Za-z][A-Za-z0-9_-]*/', path), 'Unexpected wildcard root match'
                assert not path.startswith('/_gtopMcpAuth'), 'OAuth storage must not have a client-accessible match'
        depth += 1
    elif text == '{':
        depth += 1
    elif text == '}':
        depth -= 1
    elif text.startswith('allow') and depth == 2:
        assert re.fullmatch(r'allow\s+[^:]+:\s*if\s+false\s*;', text), 'Database-level grants are not permitted'
assert depth == 0, 'Unexpected rules structure'
assert 'service cloud.firestore' in clean, 'Expected Firestore rules'
print('Reviewed live rules: OAuth storage is inaccessible to Firebase clients.')
