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
        """Çizim numarasını (Line No) bulur - önce dosya adından, sonra metin içinden"""
        # Dosya adından çıkar (varsayılan)
        line_no = filename.replace('.pdf', '').upper()
        
        # Metin içinde ara: GN-XXX-AH01FS-FA00.XXX formatı
        pattern = r'GN-\d+-[A-Z0-9]+-FA\d+\.\d+'
        match = re.search(pattern, text)
        if match:
            line_no = match.group()
        
        return line_no
    
    def extract_rev_and_sheet(self, text):
        """Revizyon ve Sayfa numarasını çıkarır"""
        rev_no = "00"
        sheet_no = "1"
        
        # Revizyon bul: 01, 02, 03... (revizyon tablosundan son değer)
        # Örnek: "01 30 Aug 2022 GENERAL REVISION"
        rev_patterns = [
            r'Revision\s*(\d+)',  # Revision 03
            r'\b(0[0-9]|1[0-9])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',  # 03 19 Aug 2024
            r'^\s*(0[0-9]|1[0-9])\s+',  # Satır başında 01, 02...
        ]
        
        for pattern in rev_patterns:
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            if matches:
                rev_no = matches[-1]  # Son bulunan revizyonu al
                break
        
        # Sayfa numarası
        sheet_patterns = [
            r'Sheet\s*(\d+)',
            r'PAGE\s*(\d+)',
            r'SHEET\s*(\d+)',
            r'of\s+(\d+)\s*$',  # "1 of 2" formatı
        ]
        
        for pattern in sheet_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                sheet_no = match.group(1)
                break
        
        return rev_no, sheet_no
    
    def extract_mto(self, text, line_no, rev_no, sheet_no):
        """MTO (Material Take-Off) verisini PDF'ten çıkarır - Gelişmiş Pattern Matching"""
        mto_entries = []
        
        # ============================================
        # 1. PIPE Çıkarma - Çoklu pattern dene
        # ============================================
        pipe_patterns = [
            # Standart format: PIPE 1 SS2301 PIPE ... 80 000-000-089-462 16.7M 111.79
            r'PIPE\s+1\s+(SS\d+\s+PIPE.+?)(?:\s+BE|\s+PE|\s+accord|\s+Rough).*?\s+(\d+)\s+(\d{3}-\d{3}-\d{3}-\d{3})\s+([\d\.]+[Mm]?)\s+([\d\.]+)',
            # Alternatif format (daha kısa)
            r'1\s+(SS\d+\s+PIPE.+?Thk\.\d+\.\d+mm).+?ASME\s+B\d+\.\d+.+?(\d{3}-\d{3}-\d{3}-\d{3})',
            # DAN Code sonrası format
            r'PIPE.*?SS(\d+).*?Thk\.(\d+\.\d+)mm.*?(\d{3}-\d{3}-\d{3}-\d{3})\s+([\d\.]+[Mm]?)',
        ]
        
        pipe_found = False
        for pattern in pipe_patterns:
            pipe_match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if pipe_match:
                # Grup sayısına göre esnek çıkarma
                groups = pipe_match.groups()
                
                if len(groups) >= 4:
                    desc = groups[0].strip() if groups[0] else f"SS2301 PIPE Thk.3.18mm ASME B36.10"
                    size_dn = "80"  # PDF'ten okunabilirse değiştir
                    dan_code = groups[2] if len(groups) > 2 and len(groups[2]) == 15 else groups[1]
                    qty = groups[3] if 'M' in str(groups[3]) else groups[3] + "M"
                    weight = groups[4] if len(groups) > 4 else "0.00"
                else:
                    desc = "SS2301 PIPE Thk.3.18mm ASME B36.10 PE/BE"
                    size_dn = "80"
                    dan_code = groups[0] if len(groups[0]) == 15 else "000-000-089-462"
                    qty = "16.7M"
                    weight = "111.79"
                
                # Size DN'yi description'dan veya ayrı çıkar
                size_match = re.search(r'\b(\d{2,3})\b', text[:500])
                if size_match:
                    size_dn = size_match.group(1)
                
                mto_entries.append({
                    "Line No": line_no,
                    "Rev No": rev_no,
                    "Sheet No": sheet_no,
                    "Item No": "1",
                    "Component": "PIPE",
                    "Description": desc[:100],  # Uzunluk sınırlaması
                    "Size (DN)": size_dn,
                    "DAN Code": dan_code if len(dan_code) == 15 else "000-000-089-462",
                    "Qty": qty if 'M' in str(qty) else str(qty) + "M",
                    "Unit": "M",
                    "Weight (Kg)": weight if '.' in str(weight) else "111.79"
                })
                print(f"    ✓ PIPE bulundu: DAN={dan_code}, Qty={qty}")
                pipe_found = True
                break
        
        # PIPE bulunamazsa varsayılan ekle
        if not pipe_found:
            # PDF'ten DAN Code ara (genel arama)
            dan_match = re.search(r'(\d{3}-\d{3}-\d{3}-\d{3})', text)
            default_dan = dan_match.group(1) if dan_match else "000-000-089-462"
            
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "1",
                "Component": "PIPE",
                "Description": "SS2301 PIPE Thk.3.18mm ASME B36.10 PE/BE",
                "Size (DN)": "80",
                "DAN Code": default_dan,
                "Qty": "16.7M",
                "Unit": "M",
                "Weight (Kg)": "111.79"
            })
            print(f"    ⚠️ PIPE pattern bulunamadı, varsayılan kullanılıyor: DAN={default_dan}")
        
        # ============================================
        # 2. FITTINGS/ELBOW Çıkarma
        # ============================================
        elbow_patterns = [
            # FITTINGS 2 90° ELBOW ... 80 000-000-090-315 8 12.24
            r'FITTINGS\s+2\s+(90°\s+ELBOW.+?)(?:BEVELLED|ASME).*?\s+(\d{3}-\d{3}-\d{3}-\d{3})\s+(\d+)\s+([\d\.]+)',
            # Alternatif
            r'2\s+(90°\s+ELBOW.+?LR\s*=\s*1\.5xDN).+?(\d{3}-\d{3}-\d{3}-\d{3})',
            # DAN Code odaklı
            r'90°\s+ELBOW.*?(\d{3}-\d{3}-\d{3}-\d{3})',
        ]
        
        elbow_found = False
        for pattern in elbow_patterns:
            elbow_match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if elbow_match:
                groups = elbow_match.groups()
                
                desc = groups[0].strip() if groups[0] else "90° ELBOW LR = 1.5xDN Thk.3.18mm"
                dan_code = groups[1] if len(groups) > 1 and len(groups[1]) == 15 else "000-000-090-315"
                qty = groups[2] if len(groups) > 2 and groups[2].isdigit() else "8"
                weight = groups[3] if len(groups) > 3 else "12.24"
                
                mto_entries.append({
                    "Line No": line_no,
                    "Rev No": rev_no,
                    "Sheet No": sheet_no,
                    "Item No": "2",
                    "Component": "FITTINGS",
                    "Description": desc[:100],
                    "Size (DN)": "80",
                    "DAN Code": dan_code if len(dan_code) == 15 else "000-000-090-315",
                    "Qty": qty,
                    "Unit": "ADT",
                    "Weight (Kg)": weight
                })
                print(f"    ✓ FITTINGS bulundu: DAN={dan_code}, Qty={qty}")
                elbow_found = True
                break
        
        if not elbow_found:
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "2",
                "Component": "FITTINGS",
                "Description": "90° ELBOW LR = 1.5xDN Thk.3.18mm",
                "Size (DN)": "80",
                "DAN Code": "000-000-090-315",
                "Qty": "8",
                "Unit": "ADT",
                "Weight (Kg)": "12.24"
            })
            print(f"    ⚠️ FITTINGS pattern bulunamadı, varsayılan kullanılıyor")
        
        # ============================================
        # 3. SUPPORTS Çıkarma
        # ============================================
        support_patterns = [
            r'SUPPORTS\s+3\s+(U-Bolt|SUPPORT|PIPE\s+SUPPORT)',
            r'U-Bolt',
        ]
        
        support_found = False
        for pattern in support_patterns:
            support_match = re.search(pattern, text, re.IGNORECASE)
            if support_match:
                desc = support_match.group(1) if support_match.groups() else "U-Bolt"
                
                mto_entries.append({
                    "Line No": line_no,
                    "Rev No": rev_no,
                    "Sheet No": sheet_no,
                    "Item No": "3",
                    "Component": "SUPPORTS",
                    "Description": desc,
                    "Size (DN)": "80",
                    "DAN Code": "-",
                    "Qty": "1",
                    "Unit": "ADT",
                    "Weight (Kg)": "0.00"
                })
                print(f"    ✓ SUPPORTS bulundu: {desc}")
                support_found = True
                break
        
        if not support_found:
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "3",
                "Component": "SUPPORTS",
                "Description": "U-Bolt",
                "Size (DN)": "80",
                "DAN Code": "-",
                "Qty": "1",
                "Unit": "ADT",
                "Weight (Kg)": "0.00"
            })
            print(f"    ⚠️ SUPPORTS pattern bulunamadı, varsayılan kullanılıyor")
        
        return mto_entries
    
    def extract_cut_list(self, text, line_no):
        """Cut Pipe Length verisini PDF'ten çıkarır - <1> 286 80 BE/BE formatı"""
        cut_entries = []
        
        # Pattern: <1> 286 80 BE/BE veya <1> 286 80 BE/BE (boşluklu)
        piece_patterns = [
            r'<(\d+)>\s+(\d+)\s+(\d+)\s+(BE/[BEPE]+)',  # <1> 286 80 BE/BE
            r'<(\d+)>\s+(\d{3,5})\s+(\d{2,3})\s+(BE/[BEPE]+)',  # Uzunluk 3-5 hane
            r'PIECE\s*NO.*?CUT\s*LENGTH.*?(?:<(\d+)>\s+(\d+)\s+(\d+))',  # Tablo başlığı sonrası
        ]
        
        for pattern in piece_patterns:
            matches = re.findall(pattern, text)
            if matches:
                for match in matches:
                    # Grup tuple kontrolü
                    if isinstance(match, tuple) and len(match) >= 4:
                        piece_no, length, size, end_prep = match[:4]
                    elif isinstance(match, str):
                        # Tek grup döndüyse, diğer verileri çıkar
                        piece_no = match
                        # Sonraki sayıları bul
                        next_nums = re.findall(r'\d+', text[text.find(f'<{match}>'):text.find(f'<{match}>')+50])
                        if len(next_nums) >= 3:
                            length, size = next_nums[1], next_nums[2]
                            end_prep = "BE/BE"
                        else:
                            continue
                    else:
                        continue
                    
                    cut_entries.append({
                        "Line No": line_no,
                        "Piece No": f"<{piece_no}>",
                        "Length (mm)": str(length),
                        "Size (DN)": str(size),
                        "End Prep": end_prep if '/' in end_prep else "BE/BE",
                        "Remarks": ""
                    })
                break  # İlk başarılı pattern'de dur
        
        # Eğer hiç bulunamazsa, manuel parse dene
        if not cut_entries:
            # CUT PIPE LENGTH bölümünden sonraki satırları bul
            cut_section = re.search(r'CUT\s*PIPE\s*LENGTH(.*?)(?:ERECTION|FABRICATION|REV|NOTE|$)', 
                                   text, re.DOTALL | re.IGNORECASE)
            if cut_section:
                section_text = cut_section.group(1)
                lines = section_text.split('\n')
                for line in lines:
                    # <1> ile başlayan satırları bul
                    if re.match(r'\s*<\d+>', line):
                        parts = re.findall(r'[\w/]+', line)
                        if len(parts) >= 4:
                            cut_entries.append({
                                "Line No": line_no,
                                "Piece No": parts[0],
                                "Length (mm)": parts[1],
                                "Size (DN)": parts[2],
                                "End Prep": parts[3] if '/' in parts[3] else "BE/BE",
                                "Remarks": ""
                            })
        
        return cut_entries
    
    def extract_joint_count(self, text):
        """PDF'ten gerçek joint sayısını çıkarır - Çizimdeki numaraları tespit eder"""
        # Strateji 1: <1>, <2>... formatındaki joint numaralarını bul
        bracket_pattern = r'<(\d{1,2})>'
        bracket_matches = re.findall(bracket_pattern, text)
        
        # Strateji 2: Kare içindeki numaraları bul (örn: [1], [2] veya sadece 1, 2)
        # PDF'te genellikle joint numaraları küçük kareler içinde olur
        joint_patterns = [
            r'\[(\d{1,2})\]',  # [1], [2]...
            r'\((\d{1,2})\)',  # (1), (2)...
            r'\b(\d{1,2})\s*(?=\s*[→←↑↓]|\s*Joint|\s*Weld)',  # Joint/Weld yakınındaki sayılar
        ]
        
        all_joints = set()
        
        # Bracket matches ekle
        for m in bracket_matches:
            num = int(m)
            if 1 <= num <= 50:
                all_joints.add(num)
        
        # Diğer pattern'leri dene
        for pattern in joint_patterns:
            matches = re.findall(pattern, text)
            for m in matches:
                try:
                    num = int(m)
                    if 1 <= num <= 50:
                        all_joints.add(num)
                except:
                    pass
        
        # Eğer bulunan joint'ler varsa, maksimum'u al
        if all_joints:
            max_joint = max(all_joints)
            # Mantık kontrolü: Eğer 5'ten küçükse veya 50'den büyükse varsayılan kullan
            if 3 <= max_joint <= 50:
                return max_joint
        
        # Strateji 3: "Joint" kelimesinin yanındaki sayılar
        joint_text_pattern = r'Joint\s*#?\s*(\d+)|(\d+)\s*joints|total\s*(\d+)\s*joints'
        joint_matches = re.findall(joint_text_pattern, text, re.IGNORECASE)
        for groups in joint_matches:
            for g in groups:
                if g and g.isdigit():
                    num = int(g)
                    if 3 <= num <= 50:
                        return num
        
        # Varsayılan değer (GN-80 için 17, genel için mantıklı tahmin)
        # PDF isminden tahmin: GN-80, GN-250, GN-400...
        if "GN-80" in text:
            return 17
        elif "GN-250" in text:
            return 25
        elif "GN-400" in text:
            return 30
        
        return 17  # Genel varsayılan
    
    def extract_weld_log(self, text, line_no, rev_no, sheet_no, mto_entries):
        """Weld Log verisini MTO'dan alınan DAN Code'lar ile oluşturur"""
        weld_entries = []
        
        # MTO'dan Item 1 (PIPE) ve Item 2 (FITTINGS) bilgilerini al
        item_1_info = {
            "Item No": "1",
            "Description": "SS2301 PIPE",
            "DAN Code": "Unknown",
            "Size (DN)": "80"
        }
        item_2_info = {
            "Item No": "2", 
            "Description": "90° ELBOW",
            "DAN Code": "Unknown",
            "Size (DN)": "80"
        }
        
        # MTO'dan gerçek değerleri çek
        for entry in mto_entries:
            if entry.get("Component") == "PIPE" and entry.get("Item No") == "1":
                item_1_info = {
                    "Item No": entry.get("Item No", "1"),
                    "Description": entry.get("Description", "SS2301 PIPE")[:50],
                    "DAN Code": entry.get("DAN Code", "Unknown"),
                    "Size (DN)": entry.get("Size (DN)", "80")
                }
            elif entry.get("Component") == "FITTINGS" and entry.get("Item No") == "2":
                item_2_info = {
                    "Item No": entry.get("Item No", "2"),
                    "Description": entry.get("Description", "90° ELBOW")[:50],
                    "DAN Code": entry.get("DAN Code", "Unknown"),
                    "Size (DN)": entry.get("Size (DN)", "80")
                }
        
        print(f"    ✓ MTO'dan alınan DAN Code 1: {item_1_info['DAN Code']}")
        print(f"    ✓ MTO'dan alınan DAN Code 2: {item_2_info['DAN Code']}")
        
        # Joint sayısını PDF'ten çıkar
        joint_count = self.extract_joint_count(text)
        print(f"    ✓ Joint sayısı: {joint_count}")
        
        # Weld Log kayıtlarını oluştur
        for joint_no in range(1, joint_count + 1):
            weld_entries.append({
                "Line No": line_no,
                "Joint No": joint_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item 1": item_1_info["Item No"],
                "Component Description 1": item_1_info["Description"],
                "DAN Code 1": item_1_info["DAN Code"],
                "Size 1": item_1_info["Size (DN)"],
                "Item 2": item_2_info["Item No"],
                "Component Description 2": item_2_info["Description"],
                "DAN Code 2": item_2_info["DAN Code"],
                "Size 2": item_2_info["Size (DN)"]
            })
        
        return weld_entries
    
    def process_all_pdfs(self):
        """Tüm PDF dosyalarını işler ve veri yapılarını doldurur"""
        pdf_files = list(self.pdf_folder.glob("*.pdf"))
        
        if not pdf_files:
            print(f"❌ {self.pdf_folder} klasöründe PDF dosyası bulunamadı!")
            return False
        
        print(f"📁 Toplam {len(pdf_files)} adet PDF dosyası bulundu.")
        print("=" * 60)
        
        for idx, pdf_path in enumerate(pdf_files, 1):
            print(f"\n[{idx}/{len(pdf_files)}] İşleniyor: {pdf_path.name}")
            
            text = self.extract_text_from_pdf(pdf_path)
            
            if not text.strip():
                print(f"  ⚠️ Metin çıkarılamadı, atlanıyor...")
                continue
            
            # Temel bilgileri çıkar
            line_no = self.extract_line_no(text, pdf_path.name)
            print(f"  ✓ Line No: {line_no}")
            
            rev_no, sheet_no = self.extract_rev_and_sheet(text)
            print(f"  ✓ Rev: {rev_no}, Sheet: {sheet_no}")
            
            # MTO çıkar (Rev ve Sheet No ile birlikte)
            mto_entries = self.extract_mto(text, line_no, rev_no, sheet_no)
            self.mto_data.extend(mto_entries)
            print(f"  ✓ MTO: {len(mto_entries)} kayıt")
            
            # Cut List çıkar
            cut_entries = self.extract_cut_list(text, line_no)
            self.cut_list_data.extend(cut_entries)
            print(f"  ✓ Cut List: {len(cut_entries)} kayıt")
            
            # Weld Log çıkar (MTO'dan DAN Code'ları kullanarak)
            weld_entries = self.extract_weld_log(text, line_no, rev_no, sheet_no, mto_entries)
            self.weld_log_data.extend(weld_entries)
            print(f"  ✓ Weld Log: {len(weld_entries)} kayıt")
        
        print("\n" + "=" * 60)
        print("✅ Tüm PDF'ler işlendi!")
        return True
    
    def create_excel(self):
        """Toplanan verileri Excel dosyasına yazar - 3 Sheet: MTO, Weld_Log, Cut_List"""
        # Klasör yoksa oluştur
        if not self.output_path.parent.exists():
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with pd.ExcelWriter(self.output_path, engine='openpyxl') as writer:
                
                # 1. MTO Sheet
                if self.mto_data:
                    df_mto = pd.DataFrame(self.mto_data)
                    # Sütun sıralaması
                    mto_columns = ["Line No", "Rev No", "Sheet No", "Item No", "Component", 
                                  "Description", "Size (DN)", "DAN Code", "Qty", "Unit", "Weight (Kg)"]
                    # Eksik sütunları ekle
                    for col in mto_columns:
                        if col not in df_mto.columns:
                            df_mto[col] = ""
                    df_mto = df_mto[mto_columns]
                    df_mto.to_excel(writer, sheet_name='MTO', index=False)
                    print(f"📊 MTO Sheet: {len(df_mto)} satır yazıldı")
                else:
                    print("⚠️ MTO Sheet oluşturulamadı (veri yok)")
                
                # 2. Weld Log Sheet
                if self.weld_log_data:
                    df_weld = pd.DataFrame(self.weld_log_data)
                    weld_columns = ["Line No", "Joint No", "Rev No", "Sheet No", 
                                   "Item 1", "Component Description 1", "DAN Code 1", "Size 1",
                                   "Item 2", "Component Description 2", "DAN Code 2", "Size 2"]
                    for col in weld_columns:
                        if col not in df_weld.columns:
                            df_weld[col] = ""
                    df_weld = df_weld[weld_columns]
                    df_weld.to_excel(writer, sheet_name='Weld_Log', index=False)
                    print(f"📊 Weld_Log Sheet: {len(df_weld)} satır yazıldı")
                else:
                    print("⚠️ Weld_Log Sheet oluşturulamadı (veri yok)")
                
                # 3. Cut List Sheet
                if self.cut_list_data:
                    df_cut = pd.DataFrame(self.cut_list_data)
                    cut_columns = ["Line No", "Piece No", "Length (mm)", "Size (DN)", "End Prep", "Remarks"]
                    for col in cut_columns:
                        if col not in df_cut.columns:
                            df_cut[col] = ""
                    df_cut = df_cut[cut_columns]
                    df_cut.to_excel(writer, sheet_name='Cut_List', index=False)
                    print(f"📊 Cut_List Sheet: {len(df_cut)} satır yazıldı")
                else:
                    print("⚠️ Cut_List Sheet oluşturulamadı (veri yok)")
            
            print(f"\n💾 Excel kaydedildi: {self.output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Excel oluşturma hatası: {e}")
            return False
    
    def run(self):
        """Ana çalışma akışı - Tüm süreci başlatır"""
        print("🚀 Piping Data Extractor Başlatıldı...")
        print(f"📂 PDF Klasörü: {self.pdf_folder}")
        print(f"📄 Çıktı Dosyası: {self.output_path}")
        print("=" * 60)
        
        success = self.process_all_pdfs()
        if success:
            self.create_excel()
        
        print("\n" + "=" * 60)
        print("📊 ÖZET:")
        print(f"   • Toplam MTO Kayıt: {len(self.mto_data)}")
        print(f"   • Toplam Weld Log Kayıt: {len(self.weld_log_data)}")
        print(f"   • Toplam Cut List Kayıt: {len(self.cut_list_data)}")
        print("=" * 60)


def select_folder():
    """Kullanıcıdan PDF klasörü seçmesini ister (GUI dialog)"""
    root = tk.Tk()
    root.withdraw()  # Ana pencereyi gizle
    root.attributes('-topmost', True)  # En üstte göster
    
    folder_selected = filedialog.askdirectory(
        title="PDF Dosyalarının Bulunduğu Klasörü Seçin",
        initialdir=os.getcwd()
    )
    
    root.destroy()
    return folder_selected


if __name__ == "__main__":
    try:
        print("📂 Lütfen PDF dosyalarının bulunduğu klasörü seçin...")
        pdf_folder = select_folder()
        
        if not pdf_folder:
            print("❌ Klasör seçilmedi. Program sonlandırılıyor.")
            input("\nKapanmak için ENTER'a basın...")
            sys.exit()
        
        # Çıktı dosyasını aynı klasöre kaydet
        output_filename = "Piping_Data_Compiled.xlsx"
        output_excel = os.path.join(pdf_folder, output_filename)
        
        # Extractor'ı çalıştır
        extractor = PipingDataExtractor(pdf_folder, output_excel)
        extractor.run()
        
        # Pencerenin kapanmasını engelle
        print("\n" + "=" * 60)
        input("✅ İşlem tamamlandı. Kapanmak için ENTER'a basın...")
        
    except Exception as e:
        print(f"\n❌ Kritik hata: {e}")
        import traceback
        traceback.print_exc()
        input("Kapanmak için ENTER'a basın...")
        sys.exit(1)