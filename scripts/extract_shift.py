import pymupdf
from PIL import Image, ImageDraw, ImageFont
import os
import re
import json

def extract_shift(pdf_path, shift_id, shift_title, output_dir):
    doc = pymupdf.open(pdf_path)
    mat = pymupdf.Matrix(2.0, 2.0)
    
    stems_dir = os.path.join(output_dir, 'cards', 'stems')
    sol_dir = os.path.join(output_dir, 'cards', 'solutions')
    data_dir = os.path.join(output_dir, 'data')
    os.makedirs(stems_dir, exist_ok=True)
    os.makedirs(sol_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    
    try:
        font = ImageFont.truetype("arial.ttf", 26)
    except Exception:
        font = ImageFont.load_default()

    # Step 1: Collect all Q.No headers
    q_headers = []
    for pno in range(len(doc)):
        page = doc[pno]
        for b in page.get_text('blocks'):
            text = b[4].strip()
            m = re.match(r'^Q\.No:\s*(\d+)$', text)
            if m:
                qnum = int(m.group(1))
                q_headers.append({
                    'qnum': qnum,
                    'page': pno,
                    'y0': b[1],
                    'y1': b[3]
                })

    q_headers.sort(key=lambda x: x['qnum'])
    print(f"[{shift_id}] Found {len(q_headers)} questions.")
    
    def get_section(qnum):
        if 1 <= qnum <= 25:
            return "General Intelligence & Reasoning"
        elif 26 <= qnum <= 50:
            return "General Awareness"
        elif 51 <= qnum <= 75:
            return "Quantitative Aptitude"
        else:
            return "English Comprehension"

    questions_data = []

    for i in range(len(q_headers)):
        q = q_headers[i]
        qnum = q['qnum']
        p_start = q['page']
        p_end = q_headers[i + 1]['page'] if i + 1 < len(q_headers) else p_start
        
        # 1. Determine clip boundaries
        page_start = doc[p_start]
        y_start = max(0, q['y0'] - 4)
        
        if p_end == p_start:
            if i + 1 < len(q_headers):
                y_end = q_headers[i + 1]['y0'] - 4
            else:
                # Last question on this page
                drawings = [d for d in page_start.get_drawings() if d.get('rect') and d['rect'].y0 > q['y0']]
                y_end = max(d['rect'].y1 for d in drawings) + 6 if drawings else page_start.rect.height - 15
            
            clip = pymupdf.Rect(80, y_start, page_start.rect.width - 20, y_end)
            pix = page_start.get_pixmap(matrix=mat, clip=clip)
            full_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Coordinate mapper for drawings on p_start
            def map_coord(p, y):
                return int((y - y_start) * 2.0)
                
        else:
            # Spans across page break
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
            
            clip0 = pymupdf.Rect(80, y_start, page_start.rect.width - 20, y_bot_p0)
            clip1 = pymupdf.Rect(80, y_top_p1, page_end.rect.width - 20, y_end_p1)
            
            pix0 = page_start.get_pixmap(matrix=mat, clip=clip0)
            pix1 = page_end.get_pixmap(matrix=mat, clip=clip1)
            
            img0 = Image.frombytes("RGB", [pix0.width, pix0.height], pix0.samples)
            img1 = Image.frombytes("RGB", [pix1.width, pix1.height], pix1.samples)
            
            target_w = max(img0.width, img1.width)
            full_img = Image.new("RGB", (target_w, img0.height + img1.height), (255, 255, 255))
            full_img.paste(img0, (0, 0))
            full_img.paste(img1, (0, img0.height))
            
            def map_coord(p, y):
                if p == p_start:
                    return int((y - y_start) * 2.0)
                else:
                    return img0.height + int((y - y_top_p1) * 2.0)

        # 2. Save original solution image
        sol_rel = f"cards/solutions/{shift_id}_q{qnum}.png"
        sol_abs = os.path.join(output_dir, sol_rel)
        full_img.save(sol_abs)
        
        # 3. Detect option rows and correct key
        # Find indicator boxes across pages for this question
        raw_boxes = []
        for p in range(p_start, p_end + 1):
            page_p = doc[p]
            for d in page_p.get_drawings():
                r = d.get('rect')
                f = d.get('fill')
                if not r or not f:
                    continue
                # Indicator column check: x0 in [75, 88] and width around 35-50
                if 75 <= r.x0 <= 88 and 35 <= r.width <= 50:
                    # Check vertical bounds
                    if p == p_start and p_start == p_end:
                        if y_start <= r.y0 <= (q_headers[i + 1]['y0'] if i + 1 < len(q_headers) else 1000):
                            raw_boxes.append((p, r, f))
                    elif p == p_start and p_start < p_end:
                        if r.y0 >= y_start:
                            raw_boxes.append((p, r, f))
                    elif p == p_end and p_start < p_end:
                        if r.y0 <= (q_headers[i + 1]['y0'] if i + 1 < len(q_headers) else 1000):
                            raw_boxes.append((p, r, f))
        
        # Filter distinct indicator boxes (each option has one main box with height > 10)
        distinct_boxes = []
        for p, r, f in raw_boxes:
            # Check if this box has height > 8 (to avoid small border lines)
            if r.height >= 8:
                # Deduplicate by mapped y coordinate
                my0 = map_coord(p, r.y0)
                if not any(abs(d['my0'] - my0) < 15 for d in distinct_boxes):
                    distinct_boxes.append({
                        'page': p,
                        'rect': r,
                        'fill': f,
                        'my0': my0,
                        'my1': map_coord(p, r.y1)
                    })
        
        distinct_boxes.sort(key=lambda b: b['my0'])
        
        correct_letter = "A"
        letters = ["A", "B", "C", "D"]
        
        # Determine correct answer from Green or Yellow fill
        for opt_idx, box in enumerate(distinct_boxes[:4]):
            f = box['fill']
            letter = letters[opt_idx] if opt_idx < len(letters) else "A"
            is_green = (abs(f[0] - 0.0) < 0.15 and abs(f[1] - 0.5) < 0.15)
            is_yellow = (abs(f[0] - 1.0) < 0.15 and abs(f[1] - 1.0) < 0.15 and abs(f[2] - 0.0) < 0.15)
            if is_green or is_yellow:
                correct_letter = letter
        
        # 4. Create Clean Practice Card: Mask colors and stamp A, B, C, D badges
        practice_img = full_img.copy()
        draw = ImageDraw.Draw(practice_img)
        
        # Option column width on card is ~88px
        col_w = int((123.5 - 80) * 2.0)
        
        for opt_idx, box in enumerate(distinct_boxes[:4]):
            letter = letters[opt_idx] if opt_idx < len(letters) else "A"
            y0_px = max(0, box['my0'] - 2)
            y1_px = min(practice_img.height, box['my1'] + 2)
            
            # Clear the indicator box with crisp neutral background
            draw.rectangle([0, y0_px, col_w, y1_px], fill=(248, 249, 250), outline=(220, 224, 230), width=1)
            
            # Center the letter badge
            tb = draw.textbbox((0, 0), letter, font=font)
            tw = tb[2] - tb[0]
            th = tb[3] - tb[1]
            tx = (col_w - tw) // 2
            ty = y0_px + (y1_px - y0_px - th) // 2 - 2
            draw.text((tx, ty), letter, fill=(30, 41, 59), font=font)
        
        stem_rel = f"cards/stems/{shift_id}_q{qnum}.png"
        stem_abs = os.path.join(output_dir, stem_rel)
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
            print(f"[{shift_id}] Processed {qnum}/100 questions...")

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
    
    json_path = os.path.join(data_dir, f"{shift_id}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(shift_json, f, indent=2, ensure_ascii=False)
        
    print(f"✓ [{shift_id}] Saved shift metadata to {json_path}")
    return shift_json

if __name__ == '__main__':
    pdf = r'C:\Users\rkuma\Downloads\ssc-cgl-12th-sep-shift-1.pdf'
    out = r'C:\Users\rkuma\.gemini\antigravity\scratch\ssc-cgl-cbt'
    extract_shift(pdf, 'shift_12sep_s1', 'SSC CGL Tier-1: 12 Sep 2025 (Shift-1)', out)
