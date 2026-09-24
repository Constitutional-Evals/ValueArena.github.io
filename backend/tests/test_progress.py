from app.progress import progress


def job(**kwargs):
    return dict(state='provisioning',stage='starting',created_at=100,started_at=110,heartbeat_at=None,pod_id=None,**kwargs)


def test_startup_never_claims_worker_ready_without_heartbeat():
    j=job()
    assert progress(j,130)['title']=='Requesting GPU'
    j['pod_id']='pod'
    p=progress(j,160)
    assert p['title']=='GPU allocated · waiting for worker'
    assert p['worker_last_seen_at'] is None and p['elapsed_seconds']==60
    j.update(state='running',stage='collecting',heartbeat_at=155)
    p=progress(j,160)
    assert p['step']==3 and p['worker_last_seen_at']==155


def test_terminal_elapsed_stops_and_cleanup_is_explicit():
    j=job();j.update(state='failed',error_code='worker_start_timeout',finished_at=200)
    p=progress(j,999)
    assert p['elapsed_seconds']==100 and p['cleanup_pending']
    assert 'did not connect' in p['detail']
