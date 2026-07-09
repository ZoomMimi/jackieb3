#!/usr/bin/env python3
"""
scripts/fetch-thumbnails.py

Uses the macOS Photos framework to fetch cloud thumbnails (NOT full originals)
for voyage photos that have no local derivative. Saves them as
  {PHOTOS_LIB}/resources/derivatives/{dir}/{uuid}_1_105_c.jpeg
so the photo-viewer.mjs picks them up immediately.

Run once; safe to re-run (skips already-present files).

Usage:
  python3 scripts/fetch-thumbnails.py [--size 300]

Requires: Photos app permission (will prompt on first run).
Connection: thumbnail data only — typically 10-100 KB per photo vs 10 MB for original.
"""

import sys, os, json, time, threading
from pathlib import Path

sys.path.insert(0, os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))

import objc
import Photos
from Foundation import NSURL, NSData
from Cocoa import NSApplication, NSApp
import AppKit
import CoreFoundation

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).resolve().parent
PLANNING_DIR = SCRIPT_DIR.parent / '.planning' / 'data'
PHOTOS_LIB   = Path.home() / 'Pictures' / 'Photos Library.photoslibrary'
DERIV_ROOT   = PHOTOS_LIB / 'resources' / 'derivatives'
MISSING_JSON = PLANNING_DIR / 'missing-thumbnails.json'

THUMB_SIZE = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 300

# ── Load missing list ──────────────────────────────────────────────────────────

with open(MISSING_JSON) as f:
    missing = json.load(f)

print(f'Photos to fetch thumbnails for: {len(missing)}')

# Filter out any already downloaded since the JSON was written
to_fetch = []
for item in missing:
    uuid = item['uuid']
    d    = item['directory']
    dest = DERIV_ROOT / d / f'{uuid}_1_105_c.jpeg'
    if not dest.exists():
        to_fetch.append(item)

print(f'Still missing (not yet downloaded): {len(to_fetch)}')
if not to_fetch:
    print('Nothing to do.')
    sys.exit(0)

# ── Run on main thread with a runloop (Photos framework requires it) ──────────

app = NSApplication.sharedApplication()

done_event  = threading.Event()
results     = {'ok': 0, 'fail': 0, 'skip': 0}
lock        = threading.Lock()
in_flight   = threading.Semaphore(8)   # limit concurrent requests

mgr = Photos.PHImageManager.defaultManager()

req_opts = Photos.PHImageRequestOptions.alloc().init()
req_opts.setDeliveryMode_(Photos.PHImageRequestOptionsDeliveryModeFastFormat)
req_opts.setResizeMode_(Photos.PHImageRequestOptionsResizeModeFast)
req_opts.setNetworkAccessAllowed_(True)   # allow iCloud thumbnail download
req_opts.setSynchronous_(False)

TARGET_SIZE = AppKit.NSMakeSize(THUMB_SIZE, THUMB_SIZE * 3 // 4)

total     = len(to_fetch)
completed = [0]

def fetch_batch(items):
    """Fetch thumbnails for a list of {uuid, directory} dicts."""
    for item in items:
        uuid   = item['uuid']
        d      = item['directory']
        dest   = DERIV_ROOT / d / f'{uuid}_1_105_c.jpeg'

        if dest.exists():
            with lock:
                results['skip'] += 1
                completed[0] += 1
            in_flight.release()
            continue

        # Fetch PHAsset by local identifier
        fetch_result = Photos.PHAsset.fetchAssetsWithLocalIdentifiers_options_(
            [uuid], None
        )
        if fetch_result.count() == 0:
            with lock:
                results['fail'] += 1
                completed[0] += 1
                n = completed[0]
            in_flight.release()
            if n % 50 == 0:
                print(f'  {n}/{total}  ok={results["ok"]} fail={results["fail"]} skip={results["skip"]}')
            continue

        asset = fetch_result.objectAtIndex_(0)

        def handler(image, info, _uuid=uuid, _dest=dest):
            try:
                if image is not None:
                    # Convert NSImage → JPEG bytes → file
                    tiff = image.TIFFRepresentation()
                    bitmap = AppKit.NSBitmapImageRep.imageRepWithData_(tiff)
                    props = {AppKit.NSImageCompressionFactor: 0.82}
                    jpeg = bitmap.representationUsingType_properties_(
                        AppKit.NSBitmapImageFileTypeJPEG, props
                    )
                    if jpeg and len(jpeg) > 0:
                        _dest.parent.mkdir(parents=True, exist_ok=True)
                        with open(_dest, 'wb') as fh:
                            fh.write(jpeg)
                        with lock:
                            results['ok'] += 1
                    else:
                        with lock:
                            results['fail'] += 1
                else:
                    with lock:
                        results['fail'] += 1
            except Exception as e:
                with lock:
                    results['fail'] += 1
            finally:
                with lock:
                    completed[0] += 1
                    n = completed[0]
                in_flight.release()
                if n % 50 == 0 or n == total:
                    print(f'  {n}/{total}  ok={results["ok"]} fail={results["fail"]} skip={results["skip"]}')
                if n >= total:
                    done_event.set()

        in_flight.acquire()
        mgr.requestImageForAsset_targetSize_contentMode_options_resultHandler_(
            asset,
            TARGET_SIZE,
            Photos.PHImageContentModeAspectFit,
            req_opts,
            handler,
        )

    # If we finished before any callbacks fired (all skipped), signal done
    with lock:
        if completed[0] >= total:
            done_event.set()


# Run batch fetch on a background thread; Photos callbacks fire on main runloop
t = threading.Thread(target=fetch_batch, args=(to_fetch,), daemon=True)
t.start()

print(f'Fetching thumbnails at {THUMB_SIZE}px — thumbnails only, not full originals...')
print('(Photos app does not need to be open, but screen lock may pause downloads)\n')

start = time.time()

# Pump the runloop until done_event is set
rl = CoreFoundation.CFRunLoopGetCurrent()
while not done_event.is_set():
    CoreFoundation.CFRunLoopRunInMode(CoreFoundation.kCFRunLoopDefaultMode, 0.1, False)

elapsed = time.time() - start
print(f'\nDone in {elapsed:.0f}s')
print(f'  Saved:   {results["ok"]}')
print(f'  Failed:  {results["fail"]}')
print(f'  Skipped: {results["skip"]} (already present)')
print(f'\nRefresh http://localhost:3000 to see the new thumbnails.')
