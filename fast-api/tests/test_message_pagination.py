import unittest
from unittest.mock import AsyncMock, patch

from app.services.messages import (
    _decode_cursor,
    _encode_cursor,
    list_conversation_messages,
    list_conversations,
    save_message,
)
from app.services.message_parser import parse_message, parse_message_reaction


class CursorTests(unittest.TestCase):
    def test_cursor_round_trip(self):
        cursor = _encode_cursor(1_700_000_000_000, "wamid.example")
        self.assertEqual(_decode_cursor(cursor), (1_700_000_000_000, "wamid.example"))

    def test_invalid_cursor_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Invalid pagination cursor"):
            _decode_cursor("not-a-valid-cursor")


class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_conversation_page_uses_extra_row_for_next_cursor(self):
        store = AsyncMock()
        store.rpc.return_value = [
            _conversation("3", 300),
            _conversation("2", 200),
            _conversation("1", 100),
        ]
        with patch("app.services.messages.get_store", return_value=store):
            result = await list_conversations("phone", 2, None, "customer")

        self.assertEqual([item["contactId"] for item in result["conversations"]], ["3", "2"])
        self.assertEqual(_decode_cursor(result["nextCursor"]), (200, "2"))
        store.rpc.assert_awaited_once_with("list_crm_conversations", {
            "p_phone_number_id": "phone",
            "p_limit": 3,
            "p_before_at": None,
            "p_before_contact": None,
            "p_search": "customer",
        })

    async def test_duplicate_message_is_not_published_again(self):
        store = AsyncMock()
        store.rpc.return_value = [{"was_inserted": False, "was_changed": False}]
        message = {
            "id": "message-1", "phoneNumberId": "phone", "from": "customer", "to": "phone",
            "text": "Hello", "direction": "in", "timestamp": 100,
        }
        with patch("app.services.messages.get_store", return_value=store), patch("app.services.messages.publish", new_callable=AsyncMock) as publish:
            await save_message(message, notify=True, source="live")
        publish.assert_not_awaited()

    async def test_message_page_is_returned_oldest_to_newest(self):
        store = AsyncMock()
        store.rpc.return_value = [
            _message("3", 300),
            _message("2", 200),
            _message("1", 100),
        ]
        with patch("app.services.messages.get_store", return_value=store):
            result = await list_conversation_messages("phone", "customer", 2, None)

        self.assertEqual([item["id"] for item in result["messages"]], ["2", "3"])
        self.assertEqual(_decode_cursor(result["nextCursor"]), (200, "2"))


class MediaParsingTests(unittest.TestCase):
    def test_document_metadata_is_preserved(self):
        message = parse_message({
            "id": "wamid.media",
            "from": "923001234567",
            "timestamp": "1700000000",
            "type": "document",
            "document": {
                "id": "3233921846807368",
                "mime_type": "image/jpeg",
                "filename": "photo.jpg",
                "sha256": "checksum",
            },
        }, "422021474338984", "923205443584", "messages")

        self.assertEqual(message["type"], "document")
        self.assertEqual(message["text"], "photo.jpg")
        self.assertEqual(message["media"], {
            "id": "3233921846807368",
            "mimeType": "image/jpeg",
            "filename": "photo.jpg",
            "caption": "",
            "sha256": "checksum",
        })

    def test_text_message_has_no_media(self):
        message = parse_message({
            "id": "wamid.text",
            "from": "923001234567",
            "timestamp": "1700000000",
            "type": "text",
            "text": {"body": "Hello"},
        }, "422021474338984", "923205443584", "messages")

        self.assertEqual(message["type"], "text")
        self.assertIsNone(message["media"])


class ReactionParsingTests(unittest.TestCase):
    def test_reaction_targets_the_original_message(self):
        reaction = parse_message_reaction({
            "id": "wamid.reaction-event",
            "timestamp": "1792583088",
            "type": "reaction",
            "reaction": {"message_id": "wamid.original", "emoji": "👍"},
        })

        self.assertEqual(reaction, {
            "id": "wamid.original",
            "reactionEmoji": "👍",
            "reactionAt": 1_792_583_088_000,
        })

    def test_empty_emoji_removes_reaction(self):
        reaction = parse_message_reaction({
            "timestamp": "1792583089",
            "type": "reaction",
            "reaction": {"message_id": "wamid.original", "emoji": ""},
        })

        self.assertIsNone(reaction["reactionEmoji"])


def _conversation(contact_id: str, timestamp: int) -> dict:
    return {
        "contact_id": contact_id,
        "contact_name": f"Customer {contact_id}",
        "last_message_id": f"message-{contact_id}",
        "last_message_body": "Hello",
        "last_message_direction": "in",
        "last_message_at": timestamp,
        "unread_count": 0,
        "status": "open",
        "assigned_user_id": None,
    }


def _message(message_id: str, timestamp: int) -> dict:
    return {
        "id": message_id,
        "phone_number_id": "phone",
        "contact_id": "customer",
        "sender": "customer",
        "recipient": "phone",
        "body": "Hello",
        "direction": "in",
        "timestamp": timestamp,
        "delivery_status": "received",
        "error": None,
        "reaction_emoji": None,
        "reaction_at": None,
    }
