"""Verify access tokens with Supabase Auth before accessing grant data."""
import os
from functools import lru_cache

import config  # Load environment before creating clients.
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client
from supabase_auth.errors import AuthApiError

bearer = HTTPBearer(auto_error=False)


@lru_cache
def _auth_client():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise HTTPException(503, 'Authentication is not configured.')
    return create_client(url, key)


def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Sign in to continue.', headers={'WWW-Authenticate': 'Bearer'})
    try:
        user = _auth_client().auth.get_user(credentials.credentials).user
    except AuthApiError as error:
        raise HTTPException(401, 'Your session has expired. Sign in again.',
                            headers={'WWW-Authenticate': 'Bearer'}) from error
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(503, 'Authentication service is unavailable.') from error
    if user is None:
        raise HTTPException(401, 'Invalid access token.')
    return user
