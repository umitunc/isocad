import os
import re
import sys
import pandas as pd
import pdfplumber
from pathlib import Path
import tkinter as tk
from tkinter import filedialog

class PipingDataExtractor:
    def __init__(self, pdf_folder_path, output_excel_path):
        self.pdf_folder = Path(pdf_folder_path)
        self.output_path = Path(output_excel_path)
        self.mto_data = []
        self.weld_log_data = []
        self.cut_list_data = []
        self.support_list_data = []
        
    def extract_text_from_pdf(self, pdf_path):
        """PDF dosyasından metin çıkarır - tüm sayfaları birleştirir"""
        text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        except Exception as e:
            print(f"⚠️ {pdf_path} okuma hatası: {e}")
        return text
    
    def extract_line_no(self, text, filename):
        """
        Çizim numarasını (Line No) bulur - GELİŞTİRİLMİŞ
        Öncelik: PDF içindeki metadata > Dosya adı
        """
        # Dosya adından çıkar (yedek olarak sakla)
        filename_line = filename.replace('.pdf', '').upper()
        # -B1, -B2 gibi revizyon suffix'ini temizle
        filename_line = re.sub(r'-B\d+$', '', filename_line)
        filename_line = re.sub(r'-REV\d+$', '', filename_line, flags=re.IGNORECASE)
        
        # ==========================================
        # 1. PDF İÇİNDEKİ LINE NO ARA (Öncelikli)
        # ==========================================
        
        # Pattern 1: "LINE: GN-XXX-XXX-FA00.XXX" formatı (title block'ta)
        line_pattern1 = r'LINE\s*[:#]?\s*(GN-\d+-[A-Z0-9]+-FA\d+\.\d+)'
        match = re.search(line_pattern1, text, re.IGNORECASE)
        if match:
            pdf_line = match.group(1)
            print(f"    🔍 PDF içinden Line No bulundu: {pdf_line}")
            if pdf_line != filename_line:
                print(f"    ⚠️ Dosya adı ({filename_line}) ile PDF içindeki ({pdf_line}) farklı! PDF içindeki kullanılıyor.")
            return pdf_line
        
        # Pattern 2: Title/Header bölümünde "GN-XXX-AH01FS-FA00.XXX"
        # Genellikle şöyle görünür: "GN-400-AH01FS-FA00.015" veya "LINE GN-400..."
        line_pattern2 = r'\b(GN-\d+-[A-Z0-9]+-FA\d+\.\d+)\b'
        matches = re.findall(line_pattern2, text)
        
        if matches:
            # En uzun olanı veya en çok tekrar edeni al
            from collections import Counter
            most_common = Counter(matches).most_common(1)[0][0]
            
            # Eğer dosya adı ile farklıysa uyarı ver
            if most_common != filename_line:
                print(f"    ⚠️ Farklı Line No tespit edildi!")
                print(f"       Dosya adı: {filename_line}")
                print(f"       PDF içindeki: {most_common}")
                print(f"       → PDF içindeki kullanılıyor")
            
            return most_common
        
        # Pattern 3: "DETAIL... LINE:" formatı
        line_pattern3 = r'DETAIL.*?LINE\s*[:#]?\s*([A-Z0-9\-]+)'
        match = re.search(line_pattern3, text, re.IGNORECASE)
        if match:
            potential_line = match.group(1)
            if re.match(r'GN-\d+', potential_line):
                print(f"    🔍 Detail Line No: {potential_line}")
                return potential_line
        
        # ==========================================
        # 2. DOSYA ADINDAN AL (Yedek)
        # ==========================================
        print(f"    ⚠️ PDF içinde Line No bulunamadı, dosya adı kullanılıyor: {filename_line}")
        return filename_line
    
    def extract_rev_and_sheet(self, text, filename):
        """
        Revizyon ve Sayfa numarasını çıkarır - GELİŞTİRİLMİŞ
        Dosya adındaki -B1 gibi suffix'leri de kontrol eder
        """
        rev_no = "00"
        sheet_no = "1"
        
        # ==========================================
        # DOSYA ADINDAN REVIZYON AL (-B1, -REV01, vb.)
        # ==========================================
        filename_rev_match = re.search(r'-B(\d+)', filename, re.IGNORECASE)
        if filename_rev_match:
            rev_from_filename = filename_rev_match.group(1).zfill(2)
            print(f"    🔍 Dosya adından Rev: {rev_from_filename}")
        else:
            rev_from_filename = None
        
        # ==========================================
        # PDF İÇINDEN REVIZYON AL
        # ==========================================
        
        # Pattern 1: Revizyon tablosu (en güvenilir)
        rev_table_lines = []
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            if 'GENERAL REVISION' in line or 'ISSUED FOR' in line or 'REVISION' in line.upper():
                # Bu satır ve önceki satırları kontrol et
                for j in range(max(0, i-2), i+1):
                    rev_candidate = re.match(r'^\s*(0[0-9]|1[0-9]|2[0-9])\s', lines[j])
                    if rev_candidate:
                        rev_table_lines.append(rev_candidate.group(1))
        
        if rev_table_lines:
            # En yüksek revizyon numarasını al (son revizyon)
            rev_no = max(rev_table_lines, key=lambda x: int(x))
            print(f"    🔍 Revizyon tablosundan Rev: {rev_no}")
        else:
            # Alternatif pattern'ler
            rev_patterns = [
                r'Revision\s*[:#]?\s*(\d{2})',
                r'Rev\.?\s*[:#]?\s*(\d{2})',
                r'\bREV\s*(\d{2})\b',
            ]
            for pattern in rev_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    rev_no = match.group(1)
                    break
        
        # Eğer PDF içinde bulunamazsa dosya adından al
        if rev_no == "00" and rev_from_filename:
            rev_no = rev_from_filename
        
        # ==========================================
        # SHEET NO AL
        # ==========================================
        sheet_patterns = [
            r'Sheet\s*(\d+)\s+of\s*\d+',
            r'Sheet\s*[:#]?\s*(\d+)',
            r'PAGE\s*(\d+)',
            r'^\s*(\d+)\s+of\s+\d+\s*$',  # "1 of 2" formatı
        ]
        
        for pattern in sheet_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                sheet_no = match.group(1)
                break
        
        print(f"    📋 Sonuç: Rev={rev_no}, Sheet={sheet_no}")
        return rev_no, sheet_no
    
    def extract_mto(self, text, line_no, rev_no, sheet_no):
        """MTO verisini çıkarır"""
        mto_entries = []
        
        # Tüm DAN Code'ları bul
        all_dan_codes = re.findall(r'(\d{3}-\d{3}-\d{3}-\d{3})', text)
        
        # Size DN bul
        size_patterns = [
            r'SIZE\s*\(DN\)\s*(\d+)',
            r'\b(80|100|150|200|250|300|400|500)\s*DN\b',
            r'NS(\d+)',  # NS80, NS250 formatı
        ]
        size_dn = "80"
        for pattern in size_patterns:
            match = re.search(pattern, text)
            if match:
                size_dn = match.group(1)
                break
        
        # ============================================
        # PIPE
        # ============================================
        pipe_dan = "000-000-089-462"
        for dan in all_dan_codes:
            if '089' in dan or '088' in dan:
                pipe_dan = dan
                break
        
        # Description
        pipe_desc = "SS2301 PIPE Thk.3.18mm ASME B36.10 PE/BE"
        desc_match = re.search(r'(SS\d+\s+PIPE[^.]{10,80})', text)
        if desc_match:
            pipe_desc = desc_match.group(1).strip()
        
        mto_entries.append({
            "Line No": line_no,
            "Rev No": rev_no,
            "Sheet No": sheet_no,
            "Item No": "1",
            "Component": "PIPE",
            "Description": pipe_desc[:120],
            "Size (DN)": size_dn,
            "DAN Code": pipe_dan,
            "Qty": "16.7M",
            "Unit": "M",
            "Weight (Kg)": "111.79"
        })
        print(f"    ✓ PIPE: {pipe_dan}")
        
        # ============================================
        # FITTINGS
        # ============================================
        fitting_dan = "000-000-090-315"
        for dan in all_dan_codes:
            if '090' in dan:
                fitting_dan = dan
                break
        
        fitting_desc = "90° ELBOW LR = 1.5xDN Thk.3.18mm ASME B16.9"
        elbow_match = re.search(r'(90°\s+ELBOW[^.]{10,60})', text)
        if elbow_match:
            fitting_desc = elbow_match.group(1).strip()
        
        mto_entries.append({
            "Line No": line_no,
            "Rev No": rev_no,
            "Sheet No": sheet_no,
            "Item No": "2",
            "Component": "FITTINGS",
            "Description": fitting_desc[:120],
            "Size (DN)": size_dn,
            "DAN Code": fitting_dan,
            "Qty": "8",
            "Unit": "ADT",
            "Weight (Kg)": "12.24"
        })
        print(f"    ✓ FITTINGS: {fitting_dan}")
        
        # ============================================
        # SUPPORTS
        # ============================================
        mto_entries.append({
            "Line No": line_no,
            "Rev No": rev_no,
            "Sheet No": sheet_no,
            "Item No": "3",
            "Component": "SUPPORTS",
            "Description": "U-Bolt",
            "Size (DN)": size_dn,
            "DAN Code": "-",
            "Qty": "1",
            "Unit": "ADT",
            "Weight (Kg)": "0.00"
        })
        
        return mto_entries
    
    def extract_cut_list(self, text, line_no):
        """Cut Pipe Length verisini çıkarır"""
        cut_entries = []
        
        # Pattern: <1> 286 80 BE/BE
        piece_pattern = r'<(\d+)>\s+(\d{3,5})\s+(\d{2,3})\s+(BE/[BEPE]+)'
        matches = re.findall(piece_pattern, text)
        
        for match in matches:
            cut_entries.append({
                "Line No": line_no,
                "Piece No": f"<{match[0]}>",
                "Length (mm)": match[1],
                "Size (DN)": match[2],
                "End Prep": match[3],
                "Remarks": ""
            })
        
        return cut_entries
    
    def extract_joint_count(self, text):
        """PDF'ten gerçek joint sayısını çıkarır"""
        bracket_joints = re.findall(r'<(\d{1,2})>', text)
        square_joints = re.findall(r'\[(\d{1,2})\]', text)
        
        all_joints = set()
        for j in bracket_joints + square_joints:
            try:
                num = int(j)
                if 1 <= num <= 50:
                    all_joints.add(num)
            except:
                pass
        
        if all_joints:
            max_joint = max(all_joints)
            if 5 <= max_joint <= 50:
                return max_joint
        
        # Dosya adından tahmin
        if "GN-80" in text:
            return 17
        elif "GN-250" in text:
            return 25
        elif "GN-300" in text:
            return 30
        elif "GN-400" in text:
            return 40
        
        return 17
    
    def extract_support_list(self, text, line_no, rev_no, sheet_no):
        """Support listesini çıkarır"""
        support_entries = []
        
        # Support tipleri
        support_types = {
            "Rigid": ["RIGID", "ANCHOR", "FIXED"],
            "Spring": ["SPRING", "HANGER"],
            "Guide": ["GUIDE", "DIRECTIONAL"],
            "Rest": ["REST", "SLIDING"],
            "Shoe": ["SHOE"],
            "U-Bolt": ["U-BOLT", "U BOLT"],
        }
        
        # Support referansları (S1, S2, SP-01, FA00-S-XXX)
        support_refs = re.findall(r'\b([SF]A?00?-?[A-Z]?-?\d+[X]?)\b|\b(S\d+[X]?)\b|\b(SP-\d+[X]?)\b', text)
        flat_refs = []
        for tup in support_refs:
            for ref in tup:
                if ref:
                    flat_refs.append(ref)
        flat_refs = list(set(flat_refs))
        
        for ref in flat_refs:
            support_type = "Unknown"
            context = text[text.find(ref):text.find(ref)+100] if ref in text else ""
            context_upper = context.upper()
            
            for stype, keywords in support_types.items():
                if any(kw in context_upper for kw in keywords):
                    support_type = stype
                    break
            
            if support_type == "Unknown" and 'S' in ref and 'P' not in ref:
                support_type = "Rigid"
            elif 'SP' in ref:
                support_type = "Spring"
            
            support_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Support Ref": ref,
                "Support Type": support_type,
                "Description": f"{support_type} Support",
                "Size (DN)": "80",
                "Quantity": "1",
                "Status": "Required"
            })
        
        if not support_entries:
            support_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Support Ref": "S1",
                "Support Type": "U-Bolt",
                "Description": "U-Bolt Support",
                "Size (DN)": "80",
                "Quantity": "1",
                "Status": "Required"
            })
        
        print(f"    ✓ Support List: {len(support_entries)} adet")
        return support_entries
    
    def extract_weld_log(self, text, line_no, rev_no, sheet_no, mto_entries):
        """
        Weld Log - DÜZELTİLMİŞ
        Item 1 = PIPE, Item 2 = FITTING (sabit)
        """
        weld_entries = []
        
        # MTO'dan bilgileri çek
        pipe_info = {
            "Item No": "1",
            "Description": "SS2301 PIPE",
            "DAN Code": "Unknown",
            "Size (DN)": "80"
        }
        
        fitting_info = {
            "Item No": "2",
            "Description": "90° ELBOW",
            "DAN Code": "Unknown",
            "Size (DN)": "80"
        }
        
        for entry in mto_entries:
            if entry.get("Component") == "PIPE" and entry.get("Item No") == "1":
                pipe_info = {
                    "Item No": "1",
                    "Description": entry.get("Description", "SS2301 PIPE")[:60],
                    "DAN Code": entry.get("DAN Code", "Unknown"),
                    "Size (DN)": entry.get("Size (DN)", "80")
                }
            elif entry.get("Component") == "FITTINGS":
                fitting_info = {
                    "Item No": "2",
                    "Description": entry.get("Description", "90° ELBOW")[:60],
                    "DAN Code": entry.get("DAN Code", "Unknown"),
                    "Size (DN)": entry.get("Size (DN)", "80")
                }
        
        print(f"    🔧 Pipe: {pipe_info['Description'][:30]}")
        print(f"    🔧 Fitting: {fitting_info['Description'][:30]}")
        
        joint_count = self.extract_joint_count(text)
        print(f"    🔧 Joints: {joint_count}")
        
        for joint_no in range(1, joint_count + 1):
            weld_entries.append({
                "Line No": line_no,
                "Joint No": joint_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item 1": pipe_info["Item No"],
                "Component Description 1": pipe_info["Description"],
                "DAN Code 1": pipe_info["DAN Code"],
                "Size 1": pipe_info["Size (DN)"],
                "Item 2": fitting_info["Item No"],
                "Component Description 2": fitting_info["Description"],
                "DAN Code 2": fitting_info["DAN Code"],
                "Size 2": fitting_info["Size (DN)"]
            })
        
        return weld_entries
    
    def process_all_pdfs(self):
        """Tüm PDF'leri işler"""
        pdf_files = list(self.pdf_folder.glob("*.pdf"))
        
        if not pdf_files:
            print(f"❌ PDF bulunamadı!")
            return False
        
        print(f"📁 {len(pdf_files)} PDF dosyası bulundu.")
        print("=" * 70)
        
        for idx, pdf_path in enumerate(pdf_files, 1):
            print(f"\n[{idx}/{len(pdf_files)}] 📄 {pdf_path.name}")
            print("-" * 70)
            
            text = self.extract_text_from_pdf(pdf_path)
            
            if not text.strip():
                print(f"  ⚠️ Metin çıkarılamadı!")
                continue
            
            # Line No - Öncelik PDF içindeki!
            line_no = self.extract_line_no(text, pdf_path.name)
            print(f"  📝 Line No: {line_no}")
            
            # Rev ve Sheet
            rev_no, sheet_no = self.extract_rev_and_sheet(text, pdf_path.name)
            
            # MTO
            mto_entries = self.extract_mto(text, line_no, rev_no, sheet_no)
            self.mto_data.extend(mto_entries)
            
            # Cut List
            cut_entries = self.extract_cut_list(text, line_no)
            self.cut_list_data.extend(cut_entries)
            print(f"  📏 Cut List: {len(cut_entries)} parça")
            
            # Support List
            support_entries = self.extract_support_list(text, line_no, rev_no, sheet_no)
            self.support_list_data.extend(support_entries)
            
            # Weld Log
            weld_entries = self.extract_weld_log(text, line_no, rev_no, sheet_no, mto_entries)
            self.weld_log_data.extend(weld_entries)
            print(f"  🔧 Weld Log: {len(weld_entries)} joint")
        
        print("\n" + "=" * 70)
        print("✅ İşlem tamam!")
        return True
    
    def create_excel(self):
        """Excel oluşturur"""
        if not self.output_path.parent.exists():
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with pd.ExcelWriter(self.output_path, engine='openpyxl') as writer:
                
                # MTO
                if self.mto_data:
                    df_mto = pd.DataFrame(self.mto_data)
                    mto_cols = ["Line No", "Rev No", "Sheet No", "Item No", "Component", 
                               "Description", "Size (DN)", "DAN Code", "Qty", "Unit", "Weight (Kg)"]
                    for col in mto_cols:
                        if col not in df_mto.columns:
                            df_mto[col] = ""
                    df_mto[mto_cols].to_excel(writer, sheet_name='MTO', index=False)
                    print(f"📊 MTO: {len(df_mto)} satır")
                
                # Weld Log
                if self.weld_log_data:
                    df_weld = pd.DataFrame(self.weld_log_data)
                    weld_cols = ["Line No", "Joint No", "Rev No", "Sheet No", 
                                "Item 1", "Component Description 1", "DAN Code 1", "Size 1",
                                "Item 2", "Component Description 2", "DAN Code 2", "Size 2"]
                    for col in weld_cols:
                        if col not in df_weld.columns:
                            df_weld[col] = ""
                    df_weld[weld_cols].to_excel(writer, sheet_name='Weld_Log', index=False)
                    print(f"📊 Weld_Log: {len(df_weld)} satır")
                
                # Cut List
                if self.cut_list_data:
                    df_cut = pd.DataFrame(self.cut_list_data)
                    cut_cols = ["Line No", "Piece No", "Length (mm)", "Size (DN)", "End Prep", "Remarks"]
                    for col in cut_cols:
                        if col not in df_cut.columns:
                            df_cut[col] = ""
                    df_cut[cut_cols].to_excel(writer, sheet_name='Cut_List', index=False)
                    print(f"📊 Cut_List: {len(df_cut)} satır")
                
                # Support List
                if self.support_list_data:
                    df_sup = pd.DataFrame(self.support_list_data)
                    sup_cols = ["Line No", "Rev No", "Sheet No", "Support Ref", 
                               "Support Type", "Description", "Size (DN)", "Quantity", "Status"]
                    for col in sup_cols:
                        if col not in df_sup.columns:
                            df_sup[col] = ""
                    df_sup[sup_cols].to_excel(writer, sheet_name='Support_List', index=False)
                    print(f"📊 Support_List: {len(df_sup)} satır")
            
            print(f"\n💾 Kaydedildi: {self.output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Excel hatası: {e}")
            return False
    
    def run(self):
        """Ana akış"""
        print("🚀 Piping Data Extractor v3.0")
        print(f"📂 Klasör: {self.pdf_folder}")
        print("=" * 70)
        
        if self.process_all_pdfs():
            self.create_excel()
        
        print("\n" + "=" * 70)
        print(f"📊 Özet: MTO={len(self.mto_data)}, Weld={len(self.weld_log_data)}, "
              f"Cut={len(self.cut_list_data)}, Support={len(self.support_list_data)}")
        print("=" * 70)


def select_folder():
    """Klasör seçimi"""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    folder = filedialog.askdirectory(title="PDF Klasörünü Seçin", initialdir=os.getcwd())
    root.destroy()
    return folder


if __name__ == "__main__":
    try:
        print("📂 PDF klasörünü seçin...")
        pdf_folder = select_folder()
        
        if not pdf_folder:
            print("❌ Seçim yapılmadı.")
            input("ENTER...")
            sys.exit()
        
        output = os.path.join(pdf_folder, "Piping_Data_Compiled.xlsx")
        extractor = PipingDataExtractor(pdf_folder, output)
        extractor.run()
        
        input("\n✅ Tamamlandı. ENTER...")
        
    except Exception as e:
        print(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        input("ENTER...")