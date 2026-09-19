import urllib.request
import json

# Check latest deployment
url = "https://api.vercel.com/v10/projects/prj_q04W3yINqPfxwufR9PCtogS7mEZS?teamId=team_YVWICAqUsj8wzm1jRgag64y3&includeLatestDeployments=1"
headers = {
    "Authorization": "Bearer vcp_***REDACTED***",
}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode())
        deployments = result.get('latestDeployments', [])
        for d in deployments[:3]:
            print(f"ID: {d['id']}")
            print(f"  Status: {d['readyState']}")
            print(f"  Target: {d['target']}")
            print(f"  Commit: {d['meta'].get('githubCommitSha')}")
            print(f"  Message: {d['meta'].get('githubCommitMessage')}")
            print(f"  Ref: {d['meta'].get('githubCommitRef')}")
            print()
except Exception as e:
    print(f"Error: {e}")
