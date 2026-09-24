"""Run only against the disposable Postgres service in CI, never a production DB."""
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import text
from app.db import Store
from app.models import EvaluationRequest
from app.governance import MemberUpdate

def config(**kwargs):
    return EvaluationRequest(name="test",models=["a","b"],criteria=["Kindness"],scenarios=["A scenario"],max_runtime_seconds=600,**kwargs).model_dump(exclude={"openrouter_key","runpod_key"})

URL = os.environ.get('TEST_DATABASE_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Disposable PostgreSQL service not configured')


@pytest.fixture
def store():
    db = Store(URL)
    with db.engine.begin() as connection:
        # Supabase has these roles; the disposable vanilla Postgres service does not.
        connection.execute(text("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;"))
        connection.execute(text("DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;"))
    db.initialize()
    from app.governance import PolicyUpdate
    policy = db.policy(); policy['policy']['limits']['require_credits'] = True
    db.set_policy(str(uuid4()), PolicyUpdate(**policy))
    return db


def test_concurrent_retries_reserve_once(store):
    user = str(uuid4()); store.grant(user, 1000)
    def submit(_): return store.submit(user, 'same-request', 'same-hash', config())['id']
    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(submit, range(4)))
    assert len(set(ids)) == 1
    assert store.balance(user)['credits'] == 400


def test_only_one_scheduler_holds_leadership(store):
    other = Store(URL)
    with store.scheduler_lock() as acquired:
        assert acquired
        with other.scheduler_lock() as second:
            assert not second
    with other.scheduler_lock() as later:
        assert later


def test_browser_roles_cannot_read_job_tables(store):
    with store.engine.begin() as c:
        for table in ('va_accounts', 'va_jobs', 'va_credit_ledger', 'va_presentation', 'va_job_credentials','va_members','va_policy','va_admin_audit'):
            assert not c.execute(text('SELECT has_table_privilege(:role, :table, :permission)'),
                {'role': 'authenticated', 'table': table, 'permission': 'SELECT'}).scalar()


def test_new_own_key_account_concurrent_retries(store):
    user = str(uuid4())
    store.ensure_member(user)
    store.set_member(str(uuid4()),user,MemberUpdate(version=1,status='approved'))
    request_config = config(funding='own_keys')
    def submit(_): return store.submit(user, 'retry', 'same', request_config, 'encrypted-test')['id']
    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(submit, range(4)))
    assert len(set(ids)) == 1
    assert store.balance(user)['credits'] == 0
    assert store.job_credentials(ids[0]) == 'encrypted-test'
