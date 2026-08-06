#!/usr/bin/env python3
"""Update Supabase auth settings via the Management API."""
import json
import urllib.request

# Load the anon key from .env.local
env_path = "/Users/kelex/Documents/Fortress-of-Solitude/adroit-blog/.env.local"
with open(env_path, 'r') as f:
    anon_key = ""
    for line in f:
        if 'SUPABASE_ANON_KEY' in line:
            anon_key = line.split('=', 1)[1].strip()
            break

if not anon_key or '...' in anon_key:
    print("ERROR: SUPABASE_ANON_KEY appears truncated — cannot authenticate to Management API.")
    print("Please update the anon key in .env.local and re-run this script.")
    exit(1)

# Update auth config via the Supabase Management API
# The anon key can be used as the service_role key for admin endpoints
url = "https://zrggxfdyptiahskogwnn.supabase.co/auth/v1/admin/settings"
payload = json.dumps({
    "site_url": "https://adroit.io",
    "additional_redirect_urls": [
        "https://adroit.io",
        "https://www.adroit.io",
        "https://adroit-blog.vercel.app",
        "http://localhost:3000",
    ],
    "enable_signup": True,
    "enable_confirmations": True,
    "jwt_expiry": 3600,
    "enable_refresh_token_rotation": True,
    "refresh_token_reuse_interval": 10,
    "minimum_password_length": 6,
}).encode('utf-8')

req = urllib.request.Request(
    url,
    data=payload,
    method='PATCH',
    headers={
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print("Auth config updated successfully:")
        print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    try:
        print(json.loads(e.read()))
    except:
        pass
