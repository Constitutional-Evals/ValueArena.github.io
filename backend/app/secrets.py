"""Encrypt job-scoped provider keys; never include them in job configs or artifacts."""
import base64
import hashlib
import hmac
import json
from cryptography.fernet import Fernet


def cipher(secret):
    key = hmac.new(secret.encode(), b'valuearena/provider-credentials/v1', hashlib.sha256).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(secret, values):
    return cipher(secret).encrypt(json.dumps(values).encode()).decode()


def decrypt(secret, value):
    return json.loads(cipher(secret).decrypt(value.encode())) if value else {}
