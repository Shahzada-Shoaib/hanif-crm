import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.responses import FileResponse

from app.services.media import media_path, stream_media


class MediaPathTests(unittest.TestCase):
    def test_relative_media_root_is_resolved_from_backend(self):
        with patch.dict(os.environ, {"MEDIA_ROOT": "test-storage/media"}):
            path = media_path("12345", "67890")

        self.assertTrue(path.is_absolute())
        self.assertEqual(path.parts[-4:], ("test-storage", "media", "12345", "67890"))

    def test_invalid_identifier_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Invalid media identifier"):
            media_path("../phone", "123")


class LocalMediaResponseTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_local_file_is_served_without_meta_request(self):
        store = AsyncMock()
        store.rows.return_value = [{
            "media_id": "67890",
            "media_mime_type": "image/jpeg",
            "media_filename": "photo.jpg",
        }]

        directory = Path(__file__).parent / "fixtures" / "media"
        with patch.dict(
            os.environ, {"MEDIA_ROOT": str(directory)}
        ), patch("app.services.media.get_store", return_value=store), patch(
            "app.services.media.cache_media", new_callable=AsyncMock
        ) as cache_media:
            target = Path(directory) / "12345" / "67890"
            response = await stream_media("12345", "67890", None)

        self.assertIsInstance(response, FileResponse)
        self.assertEqual(Path(response.path), target)
        self.assertEqual(response.media_type, "image/jpeg")
        cache_media.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
