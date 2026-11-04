import unittest
from unittest.mock import AsyncMock, patch

from app.services.webhook import _handle_change


class UnknownConnectionWebhookTests(unittest.IsolatedAsyncioTestCase):
    async def test_message_for_unimported_number_is_ignored(self):
        change = {
            "field": "messages",
            "value": {
                "metadata": {
                    "phone_number_id": "422021474338984",
                    "display_phone_number": "923205443584",
                },
                "messages": [{"id": "wamid.example"}],
            },
        }

        with patch(
            "app.services.webhook.get_connection",
            new_callable=AsyncMock,
            return_value=None,
        ) as get_connection, patch(
            "app.services.webhook.save_live_messages",
            new_callable=AsyncMock,
        ) as save_live_messages:
            await _handle_change({}, change)

        get_connection.assert_awaited_once_with("422021474338984")
        save_live_messages.assert_not_awaited()

    async def test_message_for_imported_number_is_saved(self):
        value = {
            "metadata": {
                "phone_number_id": "422021474338984",
                "display_phone_number": "923205443584",
            },
            "messages": [{"id": "wamid.example"}],
        }
        change = {"field": "messages", "value": value}

        with patch(
            "app.services.webhook.get_connection",
            new_callable=AsyncMock,
            return_value={"phoneNumberId": "422021474338984"},
        ), patch(
            "app.services.webhook.save_live_messages",
            new_callable=AsyncMock,
        ) as save_live_messages:
            await _handle_change({}, change)

        save_live_messages.assert_awaited_once_with(
            value,
            "messages",
            "422021474338984",
            "923205443584",
        )


if __name__ == "__main__":
    unittest.main()
