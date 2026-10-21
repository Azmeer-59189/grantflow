"""Header-matched Sheet writes, checked against an in-memory fake of the Sheets API."""
import unittest
from unittest.mock import patch

from services import sheets_writer
from services.data_processor import row_version
from services.sheets_reader import parse_headers, row_record


class FakeRequest:
    def __init__(self, result=None):
        self.result = result or {}

    def execute(self):
        return self.result


class FakeValues:
    def __init__(self, rows):
        self.rows = rows
        self.appended = None
        self.batch = None

    def get(self, **kwargs):
        return FakeRequest({'values': self.rows})

    def append(self, **kwargs):
        self.appended = kwargs['body']['values'][0]
        return FakeRequest()

    def batchUpdate(self, **kwargs):
        self.batch = kwargs['body']['data']
        return FakeRequest()


class SheetsWriterTests(unittest.TestCase):
    def setUp(self):
        # Sheet columns in a different order, with an extra column in the middle.
        labels = list(reversed(sheets_writer.COLUMN_ORDER))
        labels.insert(3, 'Internal Notes')
        self.header = labels
        existing = ['' for _ in labels]
        existing[labels.index('Grant Number')] = 'G-1'
        existing[labels.index('Supplier')] = 'Old'
        existing[3] = '=SUM(1,2)'
        self.existing = existing
        self.fake = FakeValues([labels, existing])
        self.grant = {sheets_writer._normalise_header(label): '' for label in sheets_writer.COLUMN_ORDER}
        self.grant.update(grant_number='G-1', supplier='New', quantity=None)
        patcher = patch.object(sheets_writer, '_values_api', return_value=(self.fake, 'sheet-id'))
        patcher.start()
        self.addCleanup(patcher.stop)

    def version(self):
        return row_version(row_record(parse_headers(self.header), self.existing))

    def test_append_places_values_by_header_and_blanks_unknown_columns(self):
        sheets_writer.append_grant(dict(self.grant, grant_number='G-2'))
        row = self.fake.appended
        self.assertEqual(row[self.header.index('Grant Number')], 'G-2')
        self.assertEqual(row[self.header.index('Supplier')], 'New')
        self.assertEqual(row[self.header.index('Quantity')], '')
        self.assertEqual(row[3], '')

    def test_duplicate_grant_number_is_rejected(self):
        with self.assertRaises(sheets_writer.DuplicateGrantError):
            sheets_writer.append_grant(self.grant)
        self.assertIsNone(self.fake.appended)

    def test_update_skips_columns_grantflow_does_not_own(self):
        sheets_writer.update_grant('G-1', self.grant, expected_version=self.version())
        ranges = [item['range'] for item in self.fake.batch]
        self.assertEqual(len(ranges), 2)  # split around the extra column D
        self.assertTrue(ranges[0].endswith('!A2:C2'))
        self.assertTrue(ranges[1].startswith('Grants!E2:'))
        written = self.fake.batch[0]['values'][0] + self.fake.batch[1]['values'][0]
        self.assertIn('New', written)
        self.assertNotIn('=SUM(1,2)', written)

    def test_stale_version_is_refused(self):
        with self.assertRaises(sheets_writer.GrantConflictError):
            sheets_writer.update_grant('G-1', self.grant, expected_version='stale')
        self.assertIsNone(self.fake.batch)

    def test_missing_column_refuses_every_write(self):
        self.fake.rows[0] = [label for label in self.header if label != 'Payment Status']
        with self.assertRaisesRegex(sheets_writer.WriteRejectedError, 'Payment Status'):
            sheets_writer.append_grant(dict(self.grant, grant_number='G-3'))
        with self.assertRaises(sheets_writer.WriteRejectedError):
            sheets_writer.update_grant('G-1', self.grant)
        self.assertIsNone(self.fake.appended)
        self.assertIsNone(self.fake.batch)

    def test_duplicate_rows_block_editing(self):
        self.fake.rows.append(list(self.existing))
        with self.assertRaisesRegex(sheets_writer.WriteRejectedError, 'rows 2, 3'):
            sheets_writer.update_grant('G-1', self.grant)

    def test_exchange_rate_written_only_when_the_sheet_has_the_column(self):
        sheets_writer.append_grant(dict(self.grant, grant_number='G-4', exchange_rate=0.73))
        self.assertNotIn(0.73, self.fake.appended)
        self.fake.rows[0] = self.header + ['Exchange Rate']
        sheets_writer.append_grant(dict(self.grant, grant_number='G-5', exchange_rate=0.73))
        self.assertEqual(self.fake.appended[-1], 0.73)

    def test_column_letters(self):
        self.assertEqual([sheets_writer._column_letter(i) for i in (0, 25, 26, 54, 701)],
                         ['A', 'Z', 'AA', 'BC', 'ZZ'])


if __name__ == '__main__':
    unittest.main()
