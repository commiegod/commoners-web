#!/usr/bin/env python3
"""
MidEvils Meme Archive — Mac Downloader
Run this script from the folder containing meme_registry.json.
It will download all undownloaded images into by-month/twitter/{month}/ folders
and mark each as downloaded in the registry.

Usage:
    cd /path/to/web/data/midevils
    python3 run_this_on_your_mac.py

Last generated: 2026-04-06
Undownloaded at generation time: 19 images
"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

REGISTRY_FILE = Path(__file__).parent / "meme_registry.json"
BASE_DIR = Path(__file__).parent / "by-month" / "twitter"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/122.0.0.0 Safari/537.36"
}


def download_image(url: str, dest_path: Path) -> bool:
    """Download a single image. Returns True on success."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(data)
        return True
    except urllib.error.HTTPError as e:
        print(f"    HTTP {e.code}: {url}")
        return False
    except Exception as e:
        print(f"    Error: {e}")
        return False


def main():
    with open(REGISTRY_FILE) as f:
        registry = json.load(f)

    to_download = [e for e in registry if not e.get("downloaded")]
    print(f"Registry: {len(registry)} total entries, {len(to_download)} to download\n")

    if not to_download:
        print("Nothing to download — all entries already marked downloaded.")
        return

    downloaded_count = 0
    skipped_count = 0

    for i, entry in enumerate(to_download, 1):
        month = entry.get("month", "unknown")
        filename = entry["filename"]
        img_url = entry["img_url"]
        dest = BASE_DIR / month / filename

        print(f"[{i}/{len(to_download)}] {filename}")

        if dest.exists():
            print(f"    Already on disk — marking downloaded")
            entry["downloaded"] = True
            downloaded_count += 1
            continue

        print(f"    {img_url[:70]}...")
        success = download_image(img_url, dest)

        if success:
            size_kb = dest.stat().st_size // 1024
            print(f"    Saved ({size_kb} KB) → {dest}")
            entry["downloaded"] = True
            downloaded_count += 1
        else:
            print(f"    FAILED — skipping")
            skipped_count += 1

        # Save registry after each successful download
        if success:
            with open(REGISTRY_FILE, "w") as f:
                json.dump(registry, f, indent=2)

        time.sleep(0.3)  # be polite

    # Final save
    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"\nDone. Downloaded: {downloaded_count}, Failed: {skipped_count}")
    print(f"Files saved to: {BASE_DIR}")


if __name__ == "__main__":
    main()
