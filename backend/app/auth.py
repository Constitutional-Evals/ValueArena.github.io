import hashlib
import hmac
from uuid import UUID

import httpx
from fastapi import HTTPException


def worker_token(secret, job_id):
    return hmac.new(secret.encode(), str(job_id).encode(), hashlib.sha256).hexdigest()


def bearer(header):
    if not header or not header.startswith('Bearer '):
        raise HTTPException(401, 'Bearer token required')
    return header[7:]


class SupabaseAuth:
    def __init__(self, settings):
        self.settings = settings

    def user(self, token):
        try:
            response = httpx.get(f'{self.settings.supabase_url}/auth/v1/user',
                headers={'apikey': self.settings.supabase_publishable_key, 'Authorization': f'Bearer {token}'}, timeout=15)
            if response.status_code in (401, 403):
                raise HTTPException(401, 'Invalid or expired login')
            response.raise_for_status()
            return str(UUID(response.json()['id']))
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, KeyError):
            raise HTTPException(503, 'Authentication service unavailable') from None
