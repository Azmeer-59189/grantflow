import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from main import app
from api.auth import require_user

TARGET = '11111111-1111-4111-8111-111111111111'
ACTOR = '22222222-2222-4222-8222-222222222222'


class TeamAccessTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def sign_in(self, role):
        app.dependency_overrides[require_user] = lambda: SimpleNamespace(
            id=ACTOR, app_metadata={'grantflow_role': role})

    def test_ordinary_users_cannot_manage_or_list_accounts(self):
        for role in ['viewer', 'editor']:
            self.sign_in(role)
            with patch('api.access.get_supabase_client') as database:
                self.assertEqual(self.client.get('/api/access/users').status_code, 403)
                self.assertEqual(self.client.get('/api/access/history').status_code, 403)
                self.assertEqual(self.client.patch(f'/api/access/users/{TARGET}', json={'role': 'owner'}).status_code, 403)
                database.assert_not_called()

    def test_no_anonymous_access(self):
        for path in ['/api/access/users', '/api/access/history']:
            self.assertEqual(self.client.get(path).status_code, 401)

    def test_list_exposes_only_required_fields(self):
        self.sign_in('owner')
        with patch('api.access.get_supabase_client') as database:
            database.return_value.auth.admin.list_users.return_value = [SimpleNamespace(
                id=TARGET, email='person@example.org', app_metadata={'grantflow_role': 'viewer'},
                user_metadata={'private': 'not returned'})]
            response = self.client.get('/api/access/users?page=2')
            database.return_value.auth.admin.list_users.assert_called_once_with(page=2, per_page=50)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()[0]), {'id', 'email', 'role'})

    def test_role_change_uses_verified_actor_not_request_actor(self):
        self.sign_in('owner')
        with patch('api.access.get_supabase_client') as database:
            database.return_value.rpc.return_value.execute.return_value.data = {'id': TARGET, 'role': 'admin'}
            response = self.client.patch(f'/api/access/users/{TARGET}', json={'role': 'admin', 'actor': TARGET})
            database.return_value.rpc.assert_called_once_with('grantflow_change_role', {
                'actor': ACTOR, 'target': TARGET, 'new_role': 'admin'})
        self.assertEqual(response.status_code, 200)

    def test_rpc_permission_last_owner_and_missing_user_errors(self):
        self.sign_in('owner')
        for code, expected in [('42501', 403), ('23514', 409), ('P0002', 404)]:
            with patch('api.access.get_supabase_client') as database:
                database.return_value.rpc.return_value.execute.side_effect = APIError({'message': 'test', 'code': code, 'details': None, 'hint': None})
                response = self.client.patch(f'/api/access/users/{TARGET}', json={'role': 'disabled'})
            self.assertEqual(response.status_code, expected)

    def test_invalid_roles_and_identifiers_are_rejected(self):
        self.sign_in('owner')
        with patch('api.access.get_supabase_client') as database:
            self.assertEqual(self.client.patch(f'/api/access/users/{TARGET}', json={'role': 'superuser'}).status_code, 422)
            self.assertEqual(self.client.patch('/api/access/users/not-a-uuid', json={'role': 'viewer'}).status_code, 422)
            database.assert_not_called()

    def test_revoked_account_cannot_read_even_with_existing_token(self):
        with patch('api.auth._auth_client') as auth:
            auth.return_value.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(
                id=ACTOR, app_metadata={'grantflow_role': 'disabled'}))
            self.assertEqual(self.client.get('/api/grants', headers={'Authorization': 'Bearer existing-token'}).status_code, 403)

    def test_owner_is_allowed_to_edit_grants(self):
        self.sign_in('owner')
        with patch('api.routes.check_grant_number_exists', return_value=False), patch('api.routes._audited_write', return_value=None):
            response = self.client.post('/api/grants', json={'country': 'Canada', 'chapter': 'IDF',
                'grant_number': 'TEST-OWNER', 'project_type': 'Expansion', 'supplier': 'A', 'item': 'B'})
        self.assertEqual(response.status_code, 201)
