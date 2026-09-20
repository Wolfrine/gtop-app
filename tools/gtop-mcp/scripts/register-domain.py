"""Add only this service's origin to existing Firebase Authentication domains."""
import json
import os
import urllib.request
from urllib.parse import urlsplit

endpoint = 'https://identitytoolkit.googleapis.com/admin/v2/projects/gtop-app/config'
headers = {'Authorization': 'Bearer ' + os.environ['ACCESS_TOKEN'], 'Content-Type': 'application/json'}
with urllib.request.urlopen(urllib.request.Request(endpoint, headers=headers)) as response:
    config = json.load(response)
domain = urlsplit(os.environ['PUBLIC_ORIGIN']).hostname
domains = config.get('authorizedDomains', [])
if domain not in domains:
    request = urllib.request.Request(endpoint + '?updateMask=authorizedDomains', method='PATCH',
        headers=headers, data=json.dumps({'authorizedDomains': domains + [domain]}).encode())
    with urllib.request.urlopen(request) as response:
        assert domain in json.load(response)['authorizedDomains']
print('Firebase Authentication recognizes the MCP service domain.')
