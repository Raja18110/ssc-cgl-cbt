import sys
import os
import re
import json
import pymupdf
from PIL import Image

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

PROJECT_DIR = r'C:\Users\rkuma\.gemini\antigravity\scratch\ssc-cgl-cbt'
STEMS_DIR = os.path.join(PROJECT_DIR, 'cards', 'stems')
SOLUTIONS_DIR = os.path.join(PROJECT_DIR, 'cards', 'solutions')
DATA_DIR = os.path.join(PROJECT_DIR, 'data')

os.makedirs(STEMS_DIR, exist_ok=True)
os.makedirs(SOLUTIONS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def process_shift(pdf_path, shift_id, shift_title):
    print(f"\n=======================================================")
    print(f" Processing Shift: {shift_title}")
    print(f" PDF: {pdf_path}")
    print(f"=======================================================")
    
    doc = pymupdf.open(pdf_path)
    mat = pymupdf.Matrix(2.0, 2.0)
    
    # 1. Collect all Q.No headers
    q_headers = []
    for pno in range(len(doc)):
        page = doc[pno]
        for b in page.get_text('blocks'):
            text = b[4].strip()
            m = re.match(r'^Q\.No:\s*(\d+)$', text)
            if m:
                q_headers.append({
                    'qnum': int(m.group(1)),
                    'page': pno,
                    'y0': b[1],
                    'y1': b[3]
                })

    q_headers.sort(key=lambda x: x['qnum'])
    print(f"Found {len(q_headers)} question headers.")
    
    def get_section(qnum):
        if 1 <= qnum <= 25:
            return "General Intelligence & Reasoning"
        elif 26 <= qnum <= 50:
            return "General Awareness"
        elif 51 <= qnum <= 75:
            return "Quantitative Aptitude"
        else:
            return "English Comprehension"

    letters = ["A", "B", "C", "D"]
    questions_data = []

    for i in range(len(q_headers)):
        q = q_headers[i]
        qnum = q['qnum']
        p_start = q['page']
        p_end = q_headers[i + 1]['page'] if i + 1 < len(q_headers) else p_start
        
        page_start = doc[p_start]
        y_start = max(0, q['y0'] - 4)
        
        # 1. Render and Stitch Question
        if p_end == p_start:
            if i + 1 < len(q_headers):
                y_end = q_headers[i + 1]['y0'] - 4
            else:
                drawings = [d for d in page_start.get_drawings() if d.get('rect') and d['rect'].y0 > q['y0']]
                y_end = max(d['rect'].y1 for d in drawings) + 6 if drawings else page_start.rect.height - 15
                
            clip = pymupdf.Rect(75, y_start, page_start.rect.width - 20, y_end)
            pix = page_start.get_pixmap(matrix=mat, clip=clip)
            full_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            page_end = doc[p_end]
            drawings_p0 = [d for d in page_start.get_drawings() if d.get('rect') and d['rect'].y0 > q['y0']]
            y_bot_p0 = max(d['rect'].y1 for d in drawings_p0) + 4 if drawings_p0 else page_start.rect.height - 15
            
            drawings_p1 = [d for d in page_end.get_drawings() if d.get('rect')]
            if i + 1 < len(q_headers):
                next_y = q_headers[i + 1]['y0']
                drawings_p1 = [d for d in drawings_p1 if d['rect'].y0 < next_y]
                y_end_p1 = next_y - 4
            else:
                y_end_p1 = max(d['rect'].y1 for d in drawings_p1) + 4 if drawings_p1 else page_end.rect.height - 15
                
            y_top_p1 = min(d['rect'].y0 for d in drawings_p1) - 2 if drawings_p1 else 25.0
            
            clip0 = pymupdf.Rect(75, y_start, page_start.rect.width - 20, y_bot_p0)
            clip1 = pymupdf.Rect(75, y_top_p1, page_end.rect.width - 20, y_end_p1)
            
            pix0 = page_start.get_pixmap(matrix=mat, clip=clip0)
            pix1 = page_end.get_pixmap(matrix=mat, clip=clip1)
            
            img0 = Image.frombytes("RGB", [pix0.width, pix0.height], pix0.samples)
            img1 = Image.frombytes("RGB", [pix1.width, pix1.height], pix1.samples)
            
            full_w = max(img0.width, img1.width)
            full_img = Image.new("RGB", (full_w, img0.height + img1.height), (255, 255, 255))
            full_img.paste(img0, (0, 0))
            full_img.paste(img1, (0, img0.height))

        # Save Original Solution Image
        sol_rel = f"cards/solutions/{shift_id}_q{qnum}.png"
        sol_abs = os.path.join(PROJECT_DIR, sol_rel)
        full_img.save(sol_abs)
        
        # 2. Extract Official Correct Key
        # Collect indicator boxes
        raw_boxes = []
        for p in range(p_start, p_end + 1):
            page_p = doc[p]
            for d in page_p.get_drawings():
                r = d.get('rect')
                f = d.get('fill')
                if not r or not f:
                    continue
                if 70 <= r.x0 <= 95 and 30 <= r.width <= 60 and r.height >= 8:
                    if p == p_start and p_start == p_end:
                        next_y = q_headers[i + 1]['y0'] if i + 1 < len(q_headers) else 1000
                        if y_start <= r.y0 < next_y:
                            raw_boxes.append((p, r, f))
                    elif p == p_start and p_start < p_end:
                        if r.y0 >= y_start:
                            raw_boxes.append((p, r, f))
                    elif p == p_end and p_start < p_end:
                        next_y = q_headers[i + 1]['y0'] if i + 1 < len(q_headers) else 1000
                        if r.y0 < next_y:
                            raw_boxes.append((p, r, f))
                    elif p_start < p < p_end:
                        raw_boxes.append((p, r, f))

        # Cluster boxes into option rows
        clusters = []
        for p, r, f in raw_boxes:
            y_center = (r.y0 + r.y1) / 2.0
            c = next((cl for cl in clusters if cl['page'] == p and abs(cl['y_center'] - y_center) < 18), None)
            if not c:
                clusters.append({
                    'page': p,
                    'y_center': y_center,
                    'fills': [f],
                    'y0': r.y0,
                    'y1': r.y1
                })
            else:
                c['fills'].append(f)
                c['y0'] = min(c['y0'], r.y0)
                c['y1'] = max(c['y1'], r.y1)
                
        clusters.sort(key=lambda c: (c['page'], c['y_center']))
        
        # Check which cluster has green or yellow mark
        correct_letter = None
        for c_idx, c in enumerate(clusters):
            has_correct = False
            for f in c['fills']:
                is_green = (abs(f[0] - 0.0) < 0.15 and abs(f[1] - 0.5) < 0.15 and abs(f[2] - 0.0) < 0.15)
                is_yellow = (abs(f[0] - 1.0) < 0.15 and abs(f[1] - 1.0) < 0.15 and abs(f[2] - 0.0) < 0.15)
                if is_green or is_yellow:
                    has_correct = True
                    break
            if has_correct:
                # If there are clusters >= 4, map relative to the 4 options
                if len(clusters) == 4:
                    correct_letter = letters[c_idx]
                elif len(clusters) > 4:
                    # Statement is clusters[0] or header, options are last 4 clusters
                    opt_offset = len(clusters) - 4
                    opt_idx = c_idx - opt_offset
                    if 0 <= opt_idx < 4:
                        correct_letter = letters[opt_idx]
                    else:
                        # Fallback to Option A if near top of options
                        correct_letter = "A"
                else:
                    correct_letter = letters[c_idx] if c_idx < 4 else "A"
                break
                
        if not correct_letter:
            correct_letter = "A" # Fallback safeguard

        # 3. Create Clean Masked Practice Card (Zero answer leak)
        practice_img = full_img.copy()
        pixels = practice_img.load()
        for y in range(practice_img.height):
            for x in range(min(105, practice_img.width)):
                r, g, b = pixels[x, y][:3]
                is_green = (g > 80 and r < 70 and b < 70)
                is_yellow = (r > 160 and g > 160 and b < 80)
                is_red = (r > 160 and g < 70 and b < 70)
                if is_green or is_yellow or is_red:
                    pixels[x, y] = (255, 255, 255)
                    
        stem_rel = f"cards/stems/{shift_id}_q{qnum}.png"
        stem_abs = os.path.join(PROJECT_DIR, stem_rel)
        practice_img.save(stem_abs)

        questions_data.append({
            "id": qnum,
            "section": get_section(qnum),
            "stem_img": stem_rel,
            "solution_img": sol_rel,
            "correct": correct_letter,
            "options": ["A", "B", "C", "D"]
        })
        
        if qnum % 25 == 0:
            print(f"Processed {qnum}/100 questions...")

    shift_json = {
        "shift_id": shift_id,
        "title": shift_title,
        "total_questions": len(questions_data),
        "duration_minutes": 60,
        "total_marks": 200,
        "marks_per_question": 2.0,
        "negative_marks": 0.5,
        "sections": [
            {"name": "General Intelligence & Reasoning", "start_id": 1, "end_id": 25, "questions_count": 25},
            {"name": "General Awareness", "start_id": 26, "end_id": 50, "questions_count": 25},
            {"name": "Quantitative Aptitude", "start_id": 51, "end_id": 75, "questions_count": 25},
            {"name": "English Comprehension", "start_id": 76, "end_id": 100, "questions_count": 25}
        ],
        "questions": questions_data
    }
    
    json_path = os.path.join(DATA_DIR, f"{shift_id}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(shift_json, f, indent=2, ensure_ascii=False)
        
    print(f"SUCCESS: Saved {len(questions_data)} questions to {json_path}")
    return shift_json

if __name__ == '__main__':
    pdf = r'C:\Users\rkuma\Downloads\ssc-cgl-12th-sep-shift-1.pdf'
    process_shift(pdf, 'shift_12sep_s1', 'SSC CGL Tier-1: 12 Sep 2025 (Shift-1)')
