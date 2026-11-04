import unittest
from unittest.mock import AsyncMock, patch

from app.services.webhook_events import save_account_update


class AccountUpdateTests(unittest.IsolatedAsyncioTestCase):
    async def test_reconnected_waba_gets_a_new_event_hash(self):
        store = AsyncMock()
        store.insert.side_effect = lambda table, row, *args: [row]
        value = {
            "event": "PARTNER_ADDED",
            "waba_info": {
                "waba_id": "1751333409237127",
                "owner_business_id": "204608607037637",
            },
        }

        with patch("app.services.webhook_events.get_store", return_value=store):
            await save_account_update({"id": "entry", "time": 100}, value)
            await save_account_update({"id": "entry", "time": 200}, value)

        first_event = store.insert.await_args_list[0].args[1]
        second_event = store.insert.await_args_list[2].args[1]
        self.assertNotEqual(first_event["event_hash"], second_event["event_hash"])

    async def test_same_meta_delivery_keeps_the_same_hash(self):
        store = AsyncMock()
        store.insert.side_effect = lambda table, row, *args: [row]
        value = {
            "event": "MM_LITE_TERMS_SIGNED",
            "waba_info": {"waba_id": "1751333409237127"},
        }

        with patch("app.services.webhook_events.get_store", return_value=store):
            await save_account_update({"id": "entry", "time": 100}, value)
            await save_account_update({"id": "entry", "time": 100}, value)

        first_event = store.insert.await_args_list[0].args[1]
        second_event = store.insert.await_args_list[1].args[1]
        self.assertEqual(first_event["event_hash"], second_event["event_hash"])


if __name__ == "__main__":
    unittest.main()
