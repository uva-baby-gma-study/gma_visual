#!/usr/bin/env python3
"""Local demo server for the infant motion upload flow.

This server is intentionally simple:
- serves the static app and output files from this repo
- accepts a video upload at /api/infant-motion/upload
- saves the upload under demo_uploads/
- waits a few seconds to simulate processing
- returns infant 51 as the processed result
"""

import cgi
import json
import re
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "127.0.0.1"
PORT = 8000
DEMO_SUBJECT_ID = "51"
PROCESSING_SECONDS = 5
UPLOAD_DIR = Path("demo_uploads")


def server_url(path="/"):
    return f"http://{HOST}:{PORT}{path}"


def safe_filename(filename):
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "upload.mp4")
    return cleaned.strip("._") or "upload.mp4"


class DemoHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            self.send_response(302)
            self.send_header("Location", "/app/")
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/infant-motion/upload":
            self.send_json({"status": "error", "message": "Unknown endpoint"}, status=404)
            return

        try:
            saved_path = self.save_uploaded_video()
            time.sleep(PROCESSING_SECONDS)
            result = {
                "status": "complete",
                "subjectId": DEMO_SUBJECT_ID,
                "reconBase": server_url("/output/app_reconstructions/"),
                "message": "Demo processing complete.",
                "temporaryUpload": str(saved_path)
            }
            self.write_demo_result(result)
            self.send_json(result)
        except Exception as exc:
            self.send_json(
                {"status": "failed", "message": f"Demo upload failed: {exc}"},
                status=500
            )

    def save_uploaded_video(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("Expected multipart/form-data upload")

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type
            }
        )

        if "video" not in form:
            raise ValueError("Missing form field named 'video'")

        video_field = form["video"]
        filename = safe_filename(video_field.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        saved_path = UPLOAD_DIR / f"{timestamp}_{filename}"

        with saved_path.open("wb") as output:
            while True:
                chunk = video_field.file.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)

        return saved_path

    def write_demo_result(self, result):
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        result_path = UPLOAD_DIR / "latest_result.json"
        result_path.write_text(json.dumps(result, indent=2) + "\n")

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), DemoHandler)
    print(f"Demo server running at http://{HOST}:{PORT}")
    print("Upload endpoint: /api/infant-motion/upload")
    print(f"Demo result will always load infant {DEMO_SUBJECT_ID}.")
    server.serve_forever()


if __name__ == "__main__":
    main()
