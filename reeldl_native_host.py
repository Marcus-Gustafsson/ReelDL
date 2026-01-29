"""Native messaging host that launches yt-dlp for ReelDL downloads."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Dict, Optional


def read_native_message() -> Optional[Dict[str, Any]]:
    """Read a single native messaging payload from stdin.

    Returns:
        A dictionary containing the parsed JSON payload, or None when stdin ends.
    """

    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None

    message_length = int.from_bytes(raw_length, byteorder="little")
    if message_length == 0:
        return None

    message_bytes = sys.stdin.buffer.read(message_length)
    if len(message_bytes) < message_length:
        return None

    return json.loads(message_bytes.decode("utf-8"))


def send_native_message(payload: Dict[str, Any]) -> None:
    """Send a single JSON payload to the native messaging client.

    Args:
        payload: The dictionary that will be encoded as JSON and sent.
    """

    encoded_payload = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(len(encoded_payload).to_bytes(4, byteorder="little"))
    sys.stdout.buffer.write(encoded_payload)
    sys.stdout.buffer.flush()


def resolve_yt_dlp_path(script_directory: str) -> str:
    """Resolve the yt-dlp executable path next to this script.

    Args:
        script_directory: The directory where this script lives.

    Returns:
        The absolute path to the yt-dlp executable.
    """

    executable_name = "yt-dlp.exe" if os.name == "nt" else "yt-dlp"
    return os.path.join(script_directory, executable_name)


def build_yt_dlp_command(yt_dlp_path: str, page_url: str) -> list[str]:
    """Build the yt-dlp command used to download a Facebook reel.

    Args:
        yt_dlp_path: The absolute path to the yt-dlp executable.
        page_url: The Facebook reel URL to download.

    Returns:
        A list of command arguments ready for subprocess.
    """

    return [yt_dlp_path, "--cookies-from-browser", "chrome", page_url]


def handle_download_request(message: Dict[str, Any], script_directory: str) -> Dict[str, str]:
    """Handle a single download request from the Chrome extension.

    Args:
        message: The incoming JSON message from the extension.
        script_directory: The directory where this script lives.

    Returns:
        A response dictionary that communicates success or failure.
    """

    page_url = message.get("pageUrl")
    if not isinstance(page_url, str) or not page_url.strip():
        return {"status": "error", "message": "Missing page URL for yt-dlp."}

    yt_dlp_path = resolve_yt_dlp_path(script_directory)
    if not os.path.exists(yt_dlp_path):
        return {
            "status": "error",
            "message": f"yt-dlp was not found at {yt_dlp_path}."
        }

    yt_dlp_command = build_yt_dlp_command(yt_dlp_path, page_url)

    # Beginner-friendly note: run yt-dlp in the script directory so it can find yt-dlp.exe.
    completed_process = subprocess.run(
        yt_dlp_command,
        cwd=script_directory,
        capture_output=True,
        text=True
    )

    if completed_process.returncode != 0:
        error_output = completed_process.stderr.strip() or completed_process.stdout.strip()
        return {
            "status": "error",
            "message": error_output or "yt-dlp failed with an unknown error."
        }

    return {"status": "ok", "message": "yt-dlp finished downloading the reel."}


def run_native_host() -> None:
    """Run the native messaging host loop until stdin closes."""

    script_directory = os.path.dirname(os.path.abspath(__file__))

    while True:
        incoming_message = read_native_message()
        if incoming_message is None:
            break

        action = incoming_message.get("action")
        if action == "download":
            response = handle_download_request(incoming_message, script_directory)
        else:
            response = {"status": "error", "message": "Unknown action received."}

        send_native_message(response)


if __name__ == "__main__":
    run_native_host()
