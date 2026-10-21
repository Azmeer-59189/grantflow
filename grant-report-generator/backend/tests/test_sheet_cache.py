"""Short read cache for the Google Sheet and the fallback snapshot throttle."""
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api import routes
from api.auth import require_user
from main import app
from services import sheets_reader, sheets_writer, supabase_service


class SheetCacheTests(unittest.TestCase):
    def setUp(self):
        sheets_reader.invalidate_cache()
        self.reads = 0

        def read(tab_name):
            self.reads += 1
            return [{'grant_number': f'G-{self.reads}'}]
        patcher = patch.object(sheets_reader, '_read_rows', side_effect=read)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(sheets_reader.invalidate_cache)

    def test_repeat_reads_use_the_cache(self):
        first, fresh = sheets_reader.fetch_grant_rows_with_source()
        second, cached_fresh = sheets_reader.fetch_grant_rows_with_source()
        self.assertTrue(fresh)
        self.assertFalse(cached_fresh)
        self.assertIs(first, second)
        self.assertEqual(self.reads, 1)

    def test_cache_expires(self):
        with patch.object(sheets_reader.time, 'monotonic', side_effect=[100.0, 131.0]):
            sheets_reader.fetch_grant_rows()
            sheets_reader.fetch_grant_rows()
        self.assertEqual(self.reads, 2)

    def test_cache_can_be_turned_off(self):
        with patch.dict(os.environ, {'SHEET_READ_CACHE_SECONDS': '0'}):
            sheets_reader.fetch_grant_rows()
            sheets_reader.fetch_grant_rows()
        self.assertEqual(self.reads, 2)

    def test_every_write_clears_the_cache(self):
        sheets_reader.fetch_grant_rows()
        values = MagicMock()
        values.get.return_value.execute.return_value = {'values': [sheets_writer.COLUMN_ORDER]}
        grant = {key: '' for key in sheets_writer.REQUIRED_KEYS} | {'grant_number': 'NEW'}
        with patch.object(sheets_writer, '_values_api', return_value=(values, 'sheet')):
            sheets_writer.append_grant(grant)
        self.assertEqual(sheets_reader.fetch_grant_rows()[0]['grant_number'], 'G-2')

    def test_a_write_during_a_read_does_not_cache_stale_rows(self):
        def read_while_someone_saves(tab_name):
            self.reads += 1
            sheets_reader.invalidate_cache()   # a save lands mid-read
            return [{'grant_number': 'stale'}]
        with patch.object(sheets_reader, '_read_rows', side_effect=read_while_someone_saves):
            sheets_reader.fetch_grant_rows()
        self.assertEqual(sheets_reader.fetch_grant_rows()[0]['grant_number'], 'G-2')


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        app.dependency_overrides[require_user] = lambda: MagicMock(id='user')
        self.addCleanup(app.dependency_overrides.clear)

    def test_dashboard_snapshots_only_fresh_reads(self):
        for fresh, expected in [(True, 1), (False, 0)]:
            with patch.object(routes, 'fetch_grant_rows_with_source', return_value=([], fresh)), \
                 patch.object(routes.supabase_service, 'cache_sheet_data') as snapshot:
                self.assertEqual(self.client.get('/api/grants').status_code, 200)
            self.assertEqual(snapshot.call_count, expected)

    def test_snapshots_are_throttled_and_old_ones_pruned(self):
        client = MagicMock()
        client.table.return_value.insert.return_value.execute.return_value.data = [{'id': 's'}]
        with patch.object(supabase_service, 'get_supabase_client', return_value=client), \
             patch.object(supabase_service, '_last_snapshot', 0.0), \
             patch.object(supabase_service.time, 'monotonic', side_effect=[1000.0, 1300.0, 1700.0]):
            self.assertEqual(supabase_service.cache_sheet_data([]), {'id': 's'})
            self.assertIsNone(supabase_service.cache_sheet_data([]))          # 5 minutes later
            self.assertEqual(supabase_service.cache_sheet_data([]), {'id': 's'})  # 11.6 minutes later
        self.assertEqual(client.table.return_value.insert.call_count, 2)
        self.assertEqual(client.table.return_value.delete.return_value.lt.call_count, 2)


if __name__ == '__main__':
    unittest.main()
