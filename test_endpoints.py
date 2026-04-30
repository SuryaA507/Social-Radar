#!/usr/bin/env python3
"""Test all trend API endpoints."""

import requests
import json

endpoints = [
    ("GET /api/trends", "http://127.0.0.1:8000/api/trends"),
    ("GET /api/trends/reddit", "http://127.0.0.1:8000/api/trends/reddit"),
    ("GET /api/trends/youtube", "http://127.0.0.1:8000/api/trends/youtube"),
    ("GET /api/trends/live", "http://127.0.0.1:8000/api/trends/live"),
]

print("\n" + "="*80)
print("TREND API ENDPOINT TEST RESULTS")
print("="*80 + "\n")

for label, url in endpoints:
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        status = "✓ SUCCESS" if response.status_code == 200 else f"✗ {response.status_code}"
        is_list = isinstance(data, list)
        count = len(data) if is_list else "N/A"
        print(f"{status:10} | {label:30} | Count: {count:3} | Type: {type(data).__name__}")
    except Exception as e:
        print(f"{'✗ ERROR':10} | {label:30} | {str(e)}")

print("\n" + "="*80 + "\n")
