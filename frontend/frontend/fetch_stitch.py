import urllib.request
import json
import os


PROJECT_ID = "18113359845755889303"
SCREENS = {
    "landing": "2f9f4bb3d2c548c997c84229ce7baf75",
    "dashboard": "954f1b3561c54b8f9bd8cac641e68d33",
    "booking": "ec2c522969234a779161d200a0a0878d",
    "availability": "c4afb2c7c9aa4310b03dc484e1bd2e70",
    "meetings": "271604cba24741518c2cc2ed0c5099ab"
}

URL = "https://stitch.googleapis.com/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": API_KEY
}

def call_mcp_tool(method, params):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }
    req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'), headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}

results = {}
for name, screen_id in SCREENS.items():
    print(f"Fetching {name} ({screen_id})...")
    res = call_mcp_tool("tools/call", {
        "name": "get_screen",
        "arguments": {
            "project_id": PROJECT_ID,
            "screen_id": screen_id
        }
    })
    results[name] = res

with open("stitch_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("Done. Results saved to stitch_results.json")
