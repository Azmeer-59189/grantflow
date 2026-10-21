"""Read-only production checks. An optional access token is read from the environment.

Do not put tokens in command arguments or commit them. This script never creates
or edits grants, uploads files, or generates reports in the live system.
"""
import argparse
import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request(url, token=None, method='GET', extra_headers=None):
    headers = extra_headers or {}
    if token:
        headers = dict(headers, Authorization=f'Bearer {token}')
    try:
        with urlopen(Request(url, headers=headers, method=method), timeout=60) as response:
            return response.status, response.headers, response.read()
    except HTTPError as error:
        return error.code, error.headers, error.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frontend', default='https://grantflow-sage.vercel.app')
    parser.add_argument('--api', default='https://grantflow-api-docker.onrender.com')
    args = parser.parse_args()
    frontend, api = args.frontend.rstrip('/'), args.api.rstrip('/')
    failed = False

    def check(label, ok):
        nonlocal failed
        print(f"{'PASS' if ok else 'FAIL'} {label}")
        failed |= not ok

    for path in ['/login', '/add-grant', '/history', '/audit']:
        code, _, body = request(frontend + path)
        check(f'Frontend route {path}', code == 200 and b'<html' in body.lower())
    code, _, body = request(api + '/health')
    check('Backend health', code == 200 and json.loads(body).get('status') == 'ok')
    for path in ['/api/grants', '/api/me', '/api/audit', '/api/reports/history']:
        code, _, _ = request(api + path)
        check(f'Anonymous access denied: {path}', code == 401)
    code, headers, _ = request(api + '/api/grants', method='OPTIONS', extra_headers={
        'Origin': frontend, 'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'})
    check('Production CORS', code == 200 and headers.get('Access-Control-Allow-Origin') == frontend)
    token = os.getenv('GRANTFLOW_ACCESS_TOKEN')
    if token:
        for path in ['/api/me', '/api/grants', '/api/reports/history', '/api/audit?limit=1']:
            code, _, _ = request(api + path, token)
            check(f'Authenticated read: {path}', code == 200)
    else:
        print('SKIP authenticated reads: GRANTFLOW_ACCESS_TOKEN is not set.')
    print('MANUAL: sign in, save a disposable grant, edit it, upload a test attachment, generate both report formats, and confirm history/activity. Verify a viewer is denied edits/uploads.')
    return 1 if failed else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(f'FAIL network or response error: {type(error).__name__}')
        sys.exit(1)
