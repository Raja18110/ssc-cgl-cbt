import os
import glob
from process_shift import process_shift

DOWNLOADS_DIR = r'C:\Users\rkuma\Downloads'

# Initial batch of shifts to process
TARGET_SHIFTS = [
    ('ssc-cgl-12th-sep-shift-2.pdf', 'shift_12sep_s2', 'SSC CGL Tier-1: 12 Sep 2025 (Shift-2)'),
    ('ssc-cgl-12th-sep-shift-3.pdf', 'shift_12sep_s3', 'SSC CGL Tier-1: 12 Sep 2025 (Shift-3)'),
    ('ssc-cgl-13th-sep-shift-2.pdf', 'shift_13sep_s2', 'SSC CGL Tier-1: 13 Sep 2025 (Shift-2)')
]

def main():
    for pdf_name, s_id, s_title in TARGET_SHIFTS:
        pdf_path = os.path.join(DOWNLOADS_DIR, pdf_name)
        if os.path.exists(pdf_path):
            try:
                process_shift(pdf_path, s_id, s_title)
            except Exception as e:
                print(f"Error processing {pdf_name}: {e}")
        else:
            print(f"PDF not found: {pdf_path}")

    # Build shifts index
    import json
    data_dir = r'C:\Users\rkuma\.gemini\antigravity\scratch\ssc-cgl-cbt\data'
    index_path = os.path.join(data_dir, 'shifts_index.json')
    
    shifts = []
    for f in glob.glob(os.path.join(data_dir, "shift_*.json")):
        with open(f, 'r', encoding='utf-8') as jf:
            d = json.load(jf)
            shifts.append({
                "shift_id": d["shift_id"],
                "title": d["title"],
                "total_questions": d["total_questions"],
                "duration_minutes": d["duration_minutes"],
                "total_marks": d["total_marks"]
            })
            
    shifts.sort(key=lambda x: x["shift_id"])
    with open(index_path, 'w', encoding='utf-8') as out_f:
        json.dump(shifts, out_f, indent=2, ensure_ascii=False)
        
    print(f"\n=======================================================")
    print(f" Indexed {len(shifts)} shifts in shifts_index.json")
    print(f"=======================================================")

if __name__ == '__main__':
    main()
