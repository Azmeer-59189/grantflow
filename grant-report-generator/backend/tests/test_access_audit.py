import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from api.auth import require_user, user_role
from api import routes


class AccessAuditTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.payload = dict(country='Canada', chapter='IDF', grant_number='TEST-1',
                            project_type='Expansion', supplier='Supplier', item='Pump')

    def tearDown(self):
        app.dependency_overrides.clear()

    def user(self, role='viewer'):
        user = SimpleNamespace(id='user-id', email='user@example.org', app_metadata={'grantflow_role': role})
        app.dependency_overrides[require_user] = lambda: user
        return user

    def test_roles_ignore_user_editable_metadata(self):
        user = SimpleNamespace(user_metadata={'grantflow_role': 'admin'}, app_metadata={})
        self.assertEqual(user_role(user), 'viewer')
        self.assertEqual(user_role(SimpleNamespace(app_metadata={'grantflow_role': 'unexpected'})), 'viewer')

    def test_viewer_cannot_create_or_update(self):
        self.user()
        with patch.object(routes, 'append_grant') as append, patch.object(routes, 'update_grant') as update:
            self.assertEqual(self.client.post('/api/grants', json=self.payload).status_code, 403)
            self.assertEqual(self.client.put('/api/grants/TEST-1', json=self.payload).status_code, 403)
        append.assert_not_called()
        update.assert_not_called()

    def test_editor_and_admin_can_create_with_audit_before_write(self):
        for role in ['editor', 'admin']:
            self.user(role)
            events = []
            with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes.supabase_service, 'start_audit', side_effect=lambda **kwargs: events.append(('audit', kwargs)) or 'audit-id'), patch.object(routes, 'append_grant', side_effect=lambda data: events.append(('write', data))), patch.object(routes.supabase_service, 'finish_audit') as finish:
                response = self.client.post('/api/grants', json=self.payload)
            self.assertEqual(response.status_code, 201)
            self.assertEqual([event[0] for event in events], ['audit', 'write'])
            self.assertEqual(events[0][1]['before'], {})
            self.assertEqual(events[0][1]['after']['supplier'], 'Supplier')
            finish.assert_called_once_with('audit-id', 'completed')

    def test_update_records_before_after_values(self):
        self.user('editor')
        before = dict(self.payload, supplier='Old supplier', version='v1')
        with patch.object(routes, '_get_single_grant', return_value=before), patch.object(routes.supabase_service, 'start_audit', return_value='audit-id') as audit, patch.object(routes.supabase_service, 'finish_audit'), patch.object(routes, 'update_grant') as update:
            response = self.client.put('/api/grants/TEST-1', json=dict(self.payload, version='v1'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(audit.call_args.kwargs['before']['supplier'], 'Old supplier')
        self.assertEqual(audit.call_args.kwargs['after']['supplier'], 'Supplier')
        self.assertNotIn('version', audit.call_args.kwargs['after'])
        self.assertEqual(update.call_args.kwargs['expected_version'], 'v1')

    def test_stale_or_missing_version_is_refused_before_audit(self):
        self.user('editor')
        before = dict(self.payload, version='current')
        with patch.object(routes, '_get_single_grant', return_value=before), patch.object(routes.supabase_service, 'start_audit') as audit, patch.object(routes, 'update_grant') as update:
            self.assertEqual(self.client.put('/api/grants/TEST-1', json=dict(self.payload, version='old')).status_code, 409)
            self.assertEqual(self.client.put('/api/grants/TEST-1', json=self.payload).status_code, 422)
        audit.assert_not_called()
        update.assert_not_called()

    def test_rejected_write_is_409_and_marked_rejected(self):
        self.user('editor')
        with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes.supabase_service, 'start_audit', return_value='audit-id'), patch.object(routes.supabase_service, 'finish_audit') as finish, patch.object(routes, 'append_grant', side_effect=routes.WriteRejectedError('already exists')):
            response = self.client.post('/api/grants', json=self.payload)
        self.assertEqual(response.status_code, 409)
        finish.assert_called_once_with('audit-id', 'rejected')

    def test_report_status_is_calculated_by_the_server(self):
        self.user('editor')
        written = {}
        with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes, '_audited_write', side_effect=lambda user, action, number, before, after, write: written.update(after)):
            self.client.post('/api/grants', json=dict(self.payload, report_status='Complete'))
        self.assertEqual(written['report_status'], 'Incomplete Information')
        self.assertIsNone(written['quantity'])

    def test_missing_audit_database_prevents_sheet_write(self):
        self.user('editor')
        with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes.supabase_service, 'start_audit', side_effect=RuntimeError('database unavailable')), patch.object(routes, 'append_grant') as append, self.assertLogs(level='ERROR'):
            response = self.client.post('/api/grants', json=self.payload)
        self.assertEqual(response.status_code, 503)
        append.assert_not_called()

    def test_unconfirmed_sheet_write_keeps_audit_intent(self):
        self.user('editor')
        with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes.supabase_service, 'start_audit', return_value='audit-id'), patch.object(routes.supabase_service, 'finish_audit') as finish, patch.object(routes, 'append_grant', side_effect=TimeoutError()), self.assertLogs(level='ERROR'):
            response = self.client.post('/api/grants', json=self.payload)
        self.assertEqual(response.status_code, 503)
        self.assertIn('before retrying', response.json()['detail'])
        finish.assert_called_once_with('audit-id', 'unconfirmed')

    def test_saved_grant_returns_success_if_audit_finalization_fails(self):
        self.user('editor')
        with patch.object(routes, 'check_grant_number_exists', return_value=False), patch.object(routes.supabase_service, 'start_audit', return_value='audit-id'), patch.object(routes.supabase_service, 'finish_audit', side_effect=TimeoutError()), patch.object(routes, 'append_grant'), self.assertLogs(level='ERROR'):
            response = self.client.post('/api/grants', json=self.payload)
        self.assertEqual(response.status_code, 201)
        self.assertIn('do not submit', response.json()['audit_warning'])

    def test_role_endpoint_and_paginated_audit(self):
        self.user('editor')
        self.assertEqual(self.client.get('/api/me').json()['role'], 'editor')
        with patch.object(routes.supabase_service, 'get_grant_audit', return_value=[]) as query:
            self.assertEqual(self.client.get('/api/audit?grant_number=TEST-1&limit=25&offset=25').status_code, 200)
            query.assert_called_once_with('TEST-1', 25, 25)
        self.assertEqual(self.client.get('/api/audit?limit=101').status_code, 422)
        self.assertEqual(self.client.get('/api/audit?offset=-1').status_code, 422)

    def test_new_routes_require_authentication(self):
        for path in ['/api/me', '/api/audit']:
            self.assertEqual(self.client.get(path).status_code, 401)
