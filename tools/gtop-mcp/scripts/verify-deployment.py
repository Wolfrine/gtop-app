"""No database credentials or user tokens are used in this deployment check."""
import json
import os
import urllib.request
import urllib.error

origin = os.environ['PUBLIC_ORIGIN']
for path in ['/health', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource/mcp']:
    with urllib.request.urlopen(origin + path, timeout=30) as response:
        body = json.load(response)
        assert response.status == 200
        if path.endswith('oauth-authorization-server'):
            assert body['issuer'] == origin + '/'
            assert body['code_challenge_methods_supported'] == ['S256']
        if path.endswith('oauth-protected-resource/mcp'):
            assert body['resource'] == origin + '/mcp'
    print(path + ': OK')
request = urllib.request.Request(origin + '/mcp', method='POST',
    headers={'Content-Type': 'application/json'}, data=b'{}')
try:
    urllib.request.urlopen(request, timeout=30)
    raise AssertionError('Unauthenticated MCP request unexpectedly succeeded')
except urllib.error.HTTPError as error:
    assert error.code == 401
    assert 'resource_metadata' in error.headers['WWW-Authenticate']
print('Unauthenticated database access: correctly rejected (401)')
