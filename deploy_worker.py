import requests
import json
from pathlib import Path

WORKER_JS = Path('worker.js').read_text()
ACCOUNT_ID = '60dab2cb7c2f59b40be0f6cc724f8f26'
WORKER_NAME = 'murekefumusichub'
API_TOKEN = 'cfat_***REDACTED***'  # Set via: python deploy_worker.py (token in env)

url = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
}

# Deploy worker.js with proper ES module format
files = [
    ('metadata', (None, json.dumps({
        "main_module": "worker.js",
        "modules": [
            {"name": "worker.js", "kind": "esm", "part": "user", "content_type": "application/javascript+module"}
        ],
        "bindings": [
            {"name": "ASSETS", "type": "assets", "directory": "dist"}
        ]
    }), 'application/json')),
    ('worker.js', ('worker.js', WORKER_JS, 'application/javascript+module')),
]

print(f"Deploying worker.js to Cloudflare...")
resp = requests.put(url, files=files, headers=headers, timeout=120)
print(f"Status: {resp.status_code}")
result = resp.json()
if result.get('success'):
    print("Deployment successful!")
    if result.get('result'):
        print(f"Version ID: {result['result'].get('id')}")
        print(f"ETag: {result['result'].get('etag')}")
else:
    print(f"Success: {result.get('success')}")
    if result.get('errors'):
        print(f"Errors: {json.dumps(result['errors'], indent=2)}")
    if result.get('messages'):
        print(f"Messages: {json.dumps(result.get('messages'), indent=2)}")
