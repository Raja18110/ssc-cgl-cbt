import os
import glob
import re
import json
import time
from process_shift import process_shift

DOWNLOADS_DIR = r'C:\Users\rkuma\Downloads'
PROJECT_DIR = r'C:\Users\rkuma\.gemini\antigravity\scratch\ssc-cgl-cbt'
DATA_DIR = os.path.join(PROJECT_DIR, 'data')

def sanitize_shift_id(filename):
    base = os.path.splitext(filename)[0]
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', base).lower()
    return clean

def make_title(filename):
    base = os.path.splitext(filename)[0]
    # e.g. ssc-cgl-12th-sep-shift-1 -> SSC CGL: 12th Sep (Shift-1)
    parts = base.split('-')
    cleaned_parts = [p.capitalize() for p in parts if p.lower() not in ['ssc', 'cgl']]
    return "SSC CGL 2025: " + " ".join(cleaned_parts)

def process_all_46_shifts():
    all_files = glob.glob(os.path.join(DOWNLOADS_DIR, "ssc-cgl-*.pdf"))
    
    # Filter only genuine shift files (ignore duplicates like (1) and syllabus)
    shift_files = []
    for f in all_files:
        name = os.path.basename(f)
        if re.search(r'\(\d+\)', name) or 'syllabus' in name.lower():
            continue
        shift_files.append(f)
        
    shift_files.sort()
    print(f"Found exactly {len(shift_files)} unique SSC CGL shift papers to process.")

    start_time = time.time()
    processed_count = 0
    skipped_count = 0

    for idx, pdf in enumerate(shift_files, 1):
        filename = os.path.basename(pdf)
        shift_id = sanitize_shift_id(filename)
        json_file = os.path.join(DATA_DIR, f"{shift_id}.json")
        title = make_title(filename)

        # Check if already processed
        if os.path.exists(json_file):
            print(f"[{idx}/{len(shift_files)}] Already processed: {filename}. Skipping.")
            skipped_count += 1
            continue

        print(f"\n=================================================================")
        print(f" [{idx}/{len(shift_files)}] Ingesting Shift {idx}: {title}")
        print(f"=================================================================")
        
        t0 = time.time()
        try:
            process_shift(pdf, shift_id, title)
            processed_count += 1
            elapsed = time.time() - t0
            print(f"✓ Completed {filename} in {elapsed:.1f}s.")
        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")

        # Update shifts_index.json incrementally after each shift
        update_index()

    total_time = time.time() - start_time
    print(f"\n🎉 All shifts completed in {total_time/60:.1f} minutes! (Newly processed: {processed_count}, Already existed: {skipped_count})")

def update_index():
    shifts = []
    for f in sorted(glob.glob(os.path.join(DATA_DIR, "ssc_cgl_*.json"))):
        try:
            with open(f, 'r', encoding='utf-8') as jf:
                d = json.load(jf)
                shifts.append({
                    "shift_id": d["shift_id"],
                    "title": d["title"],
                    "total_questions": d["total_questions"],
                    "duration_minutes": d["duration_minutes"],
                    "total_marks": d["total_marks"]
                })
        except Exception:
            pass

    index_path = os.path.join(DATA_DIR, 'shifts_index.json')
    with open(index_path, 'w', encoding='utf-8') as out_f:
        json.dump(shifts, out_f, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    process_all_46_shifts()
