#!/usr/bin/env python3
"""Test all trend API endpoints with extended timeout."""

import requests
import json

endpoints = [
    ("GET /api/trends", "http://127.0.0.1:8000/api/trends"),
    ("GET /api/trends/reddit", "http://127.0.0.1:8000/api/trends/reddit"),
    ("GET /api/trends/youtube", "http://127.0.0.1:8000/api/trends/youtube"),
    ("GET /api/trends/live", "http://127.0.0.1:8000/api/trends/live"),
]

print("\n" + "="*90)
print("TREND API ENDPOINT STABILITY TEST")
print("="*90 + "\n")

all_passed = True

for label, url in endpoints:
    try:
        # Use longer timeout for first request
        response = requests.get(url, timeout=30)
        data = response.json()
        status = "✓ PASS" if response.status_code == 200 else f"✗ FAIL ({response.status_code})"
        is_list = isinstance(data, list)
        count = len(data) if is_list else "N/A"
        
        # Validate JSON is valid array
        if not is_list:
            all_passed = False
            status = "✗ FAIL"
            print(f"{status:10} | {label:30} | Expected array, got {type(data).__name__}")
        else:
            print(f"{status:10} | {label:30} | Count: {count:3} items | JSON valid: ✓")
            
    except Exception as e:
        all_passed = False
        print(f"{'✗ FAIL':10} | {label:30} | ERROR: {str(e)}")

print("\n" + "="*90)
if all_passed:
    print("RESULT: ✓ ALL ENDPOINTS STABLE - FRONTEND SAFE TO LOAD")
else:
    print("RESULT: ✗ SOME ENDPOINTS FAILED")
print("="*90 + "\n")
