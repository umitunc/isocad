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
        """PDF dosyasından metin çıkarır"""
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
        """Çizim numarasını bulur"""
        line_no = filename.replace('.pdf', '').upper()
        pattern = r'GN-\d+-[A-Z0-9]+-FA\d+\.\d+'
        match = re.search(pattern, text)
        if match:
            line_no = match.group()
        return line_no
    
    def extract_rev_and_sheet(self, text):
        """Revizyon ve Sayfa numarasını çıkarır"""
        rev_no = "00"
        sheet_no = "1"
        
        # Revizyon bul (00, 01, 02...)
        rev_pattern = r'\b(00|01|02|03|04|05|06|07|08|09)\b'
        rev_matches = re.findall(rev_pattern, text)
        if rev_matches:
            rev_no = rev_matches[-1]
        
        # Sayfa numarası
        sheet_pattern = r'SHEET\s*(\d+)|PAGE\s*(\d+)'
        sheet_match = re.search(sheet_pattern, text, re.IGNORECASE)
        if sheet_match:
            sheet_no = sheet_match.group(1) or sheet_match.group(2)
        
        return rev_no, sheet_no
    
    def extract_mto(self, text, line_no, rev_no, sheet_no):
        """MTO (Material Take-Off) verisini çıkarır"""
        mto_entries = []
        
        # PIPE satırını bul - PDF formatına uygun
        # PIPE 1 SS2301 PIPE... 80 000-000-089-462 16.7M 111.79
        pipe_pattern = r'PIPE\s+1\s+(SS\d+\s+PIPE.+?)\s+80\s+(\d{3}-\d{3}-\d{3}-\d{3})\s+([\d\.]+[M]?)\s+([\d\.]+)'
        pipe_match = re.search(pipe_pattern, text, re.DOTALL)
        if pipe_match:
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "1",
                "Component": "PIPE",
                "Description": pipe_match.group(1).strip(),
                "Size (DN)": "80",
                "DAN Code": pipe_match.group(2).strip(),
                "Qty": pipe_match.group(3).strip(),
                "Unit": "M",
                "Weight (Kg)": pipe_match.group(4).strip()
            })
            print(f"    ✓ PIPE bulundu: DAN={pipe_match.group(2)}")
        
        # FITTINGS/ELBOW satırını bul
        # FITTINGS 2 90° ELBOW... 80 000-000-090-315 8 12.24
        elbow_pattern = r'FITTINGS\s+2\s+(90°\s+ELBOW.+?)\s+80\s+(\d{3}-\d{3}-\d{3}-\d{3})\s+(\d+)\s+([\d\.]+)'
        elbow_match = re.search(elbow_pattern, text, re.DOTALL)
        if elbow_match:
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "2",
                "Component": "FITTINGS",
                "Description": elbow_match.group(1).strip(),
                "Size (DN)": "80",
                "DAN Code": elbow_match.group(2).strip(),
                "Qty": elbow_match.group(3).strip(),
                "Unit": "ADT",
                "Weight (Kg)": elbow_match.group(4).strip()
            })
            print(f"    ✓ FITTINGS bulundu: DAN={elbow_match.group(2)}")
        
        # SUPPORTS satırını bul
        # SUPPORTS 3 U-Bolt 80 1 0.00
        support_pattern = r'SUPPORTS\s+3\s+(U-Bolt|SUPPORT.+?)\s+80\s+(\d{3}-\d{3}-\d{3}-\d{3})?\s+(\d+)\s+([\d\.]+)'
        support_match = re.search(support_pattern, text, re.DOTALL)
        if support_match:
            mto_entries.append({
                "Line No": line_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item No": "3",
                "Component": "SUPPORTS",
                "Description": support_match.group(1).strip(),
                "Size (DN)": "80",
                "DAN Code": support_match.group(2).strip() if support_match.group(2) else "-",
                "Qty": support_match.group(3).strip(),
                "Unit": "ADT",
                "Weight (Kg)": support_match.group(4).strip()
            })
            print(f"    ✓ SUPPORTS bulundu")
        
        return mto_entries
    
    def extract_cut_list(self, text, line_no):
        """Cut Pipe Length verisini çıkarır"""
        cut_entries = []
        
        # <1> 286 80 BE/BE formatını bul
        piece_pattern = r'<(\d+)>\s+(\d+)\s+(\d+)\s+(BE/[BE|PE]+)'
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
        """PDF'den joint sayısını çıkar (1-50 arası en büyük sayı)"""
        # Çizimdeki joint numaralarını bul (kare içindeki sayılar)
        # Örnek: 1, 2, 3... 17 şeklinde
        joint_matches = re.findall(r'\b(\d+)\b', text)
        
        if joint_matches:
            # 1-50 arası geçerli joint numaralarını filtrele
            valid_joints = [int(x) for x in joint_matches if x.isdigit() and 1 <= int(x) <= 50]
            if valid_joints:
                max_joint = max(valid_joints)
                # Makul bir joint sayısı ise kullan (10-50 arası)
                if max_joint >= 10:
                    return max_joint
        
        return 17  # Varsayılan
    
    def extract_weld_log(self, text, line_no, rev_no, sheet_no, mto_entries):
        """Weld Log verisini çıkarır"""
        weld_entries = []
        
        # MTO'dan Item 1 (PIPE) ve Item 2 (FITTINGS) bilgilerini al
        item_1_info = None
        item_2_info = None
        
        for entry in mto_entries:
            if entry.get("Component") == "PIPE":
                item_1_info = entry
            elif entry.get("Component") == "FITTINGS":
                item_2_info = entry
        
        # Varsayılan değerler (MTO bulunamazsa)
        if not item_1_info:
            item_1_info = {
                "Item No": "1",
                "Description": "SS2301 PIPE",
                "DAN Code": "Unknown",
                "Size (DN)": "80"
            }
            print("    ⚠️ PIPE bilgisi bulunamadı, varsayılan kullanılıyor")
        
        if not item_2_info:
            item_2_info = {
                "Item No": "2",
                "Description": "90° ELBOW",
                "DAN Code": "Unknown",
                "Size (DN)": "80"
            }
            print("    ⚠️ FITTINGS bilgisi bulunamadı, varsayılan kullanılıyor")
        
        # Joint sayısını PDF'den çıkar
        joint_count = self.extract_joint_count(text)
        print(f"    ✓ Joint sayısı: {joint_count}")
        
        for joint_no in range(1, joint_count + 1):
            weld_entries.append({
                "Line No": line_no,
                "Joint No": joint_no,
                "Rev No": rev_no,
                "Sheet No": sheet_no,
                "Item 1": item_1_info.get("Item No", "1"),
                "Component Description 1": item_1_info.get("Description", "Unknown"),
                "DAN Code 1": item_1_info.get("DAN Code", "Unknown"),
                "Size 1": item_1_info.get("Size (DN)", "Unknown"),
                "Item 2": item_2_info.get("Item No", "2"),
                "Component Description 2": item_2_info.get("Description", "Unknown"),
                "DAN Code 2": item_2_info.get("DAN Code", "Unknown"),
                "Size 2": item_2_info.get("Size (DN)", "Unknown")
            })
        
        return weld_entries
    
    def process_all_pdfs(self):
        """Tüm PDF dosyalarını işle"""
        pdf_files = list(self.pdf_folder.glob("*.pdf"))
        
        if not pdf_files:
            print(f"❌ {self.pdf_folder} klasöründe PDF dosyası bulunamadı!")
            return
        
        print(f"📁 Toplam {len(pdf_files)} adet PDF dosyası bulundu.")
        print("=" * 60)
        
        for idx, pdf_path in enumerate(pdf_files, 1):
            print(f"\n[{idx}/{len(pdf_files)}] İşleniyor: {pdf_path.name}")
            
            text = self.extract_text_from_pdf(pdf_path)
            
            if not text.strip():
                print(f"  ⚠️ Metin çıkarılamadı, atlanıyor...")
                continue
            
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
            
            # Weld Log çıkar
            weld_entries = self.extract_weld_log(text, line_no, rev_no, sheet_no, mto_entries)
            self.weld_log_data.extend(weld_entries)
            print(f"  ✓ Weld Log: {len(weld_entries)} kayıt")
        
        print("\n" + "=" * 60)
        print("✅ Tüm PDF'ler işlendi!")
    
    def create_excel(self):
        """Excel dosyasını oluştur"""
        if not self.output_path.parent.exists():
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with pd.ExcelWriter(self.output_path, engine='openpyxl') as writer:
            
            # MTO Sheet
            if self.mto_data:
                df_mto = pd.DataFrame(self.mto_data)
                mto_columns = ["Line No", "Rev No", "Sheet No", "Item No", "Component", 
                              "Description", "Size (DN)", "DAN Code", "Qty", "Unit", "Weight (Kg)"]
                df_mto = df_mto.reindex(columns=[col for col in mto_columns if col in df_mto.columns])
                df_mto.to_excel(writer, sheet_name='MTO', index=False)
                print(f"📊 MTO Sheet oluşturuldu: {len(df_mto)} satır")
            else:
                print("⚠️ MTO Sheet oluşturulamadı (veri yok)")
            
            # Weld Log Sheet
            if self.weld_log_data:
                df_weld = pd.DataFrame(self.weld_log_data)
                weld_columns = ["Line No", "Joint No", "Rev No", "Sheet No", 
                               "Item 1", "Component Description 1", "DAN Code 1", "Size 1",
                               "Item 2", "Component Description 2", "DAN Code 2", "Size 2"]
                df_weld = df_weld.reindex(columns=[col for col in weld_columns if col in df_weld.columns])
                df_weld.to_excel(writer, sheet_name='Weld_Log', index=False)
                print(f"📊 Weld Log Sheet oluşturuldu: {len(df_weld)} satır")
            else:
                print("⚠️ Weld Log Sheet oluşturulamadı (veri yok)")
            
            # Cut List Sheet
            if self.cut_list_data:
                df_cut = pd.DataFrame(self.cut_list_data)
                cut_columns = ["Line No", "Piece No", "Length (mm)", "Size (DN)", "End Prep", "Remarks"]
                df_cut = df_cut.reindex(columns=[col for col in cut_columns if col in df_cut.columns])
                df_cut.to_excel(writer, sheet_name='Cut_List', index=False)
                print(f"📊 Cut List Sheet oluşturuldu: {len(df_cut)} satır")
            else:
                print("⚠️ Cut List Sheet oluşturulamadı (veri yok)")
        
        print(f"\n💾 Excel dosyası kaydedildi: {self.output_path}")
    
    def run(self):
        """Tüm işlemi çalıştır"""
        print("🚀 Piping Data Extractor Başlatıldı...")
        print(f"📂 PDF Klasörü: {self.pdf_folder}")
        print(f"📄 Çıktı Dosyası: {self.output_path}")
        print("=" * 60)
        
        self.process_all_pdfs()
        self.create_excel()
        
        print("\n" + "=" * 60)
        print("✅ İşlem Tamamlandı!")
        print(f"📈 Toplam MTO Kayıt: {len(self.mto_data)}")
        print(f"📈 Toplam Weld Log Kayıt: {len(self.weld_log_data)}")
        print(f"📈 Toplam Cut List Kayıt: {len(self.cut_list_data)}")


# ============================================
# ANA PROGRAM
# ============================================

def select_folder():
    """Kullanıcıdan klasör seçimi ister"""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    
    folder_selected = filedialog.askdirectory(
        title="PDF Dosyalarının Bulunduğu Klasörü Seçin",
        initialdir="C:\\"
    )
    
    root.destroy()
    return folder_selected


if __name__ == "__main__":
    try:
        # 1. Kullanıcıdan klasör yolu al
        print("📂 Lütfen PDF dosyalarının bulunduğu klasörü seçin...")
        pdf_folder = select_folder()
        
        if not pdf_folder:
            print("❌ Klasör seçilmedi. Program sonlandırılıyor.")
            input("\nKapanmak için ENTER'a basın...")
            sys.exit()
        
        # 2. Çıktı dosyasını aynı klasöre kaydet
        output_filename = "Piping_Data_Compiled.xlsx"
        output_excel = os.path.join(pdf_folder, output_filename)
        
        # 3. Extractor'ı çalıştır
        extractor = PipingDataExtractor(pdf_folder, output_excel)
        extractor.run()
        
        # 4. Pencerenin hemen kapanmasını engelle
        print("\n" + "=" * 60)
        input("✅ İşlem tamamlandı. Kapanmak için ENTER'a basın...")
        
    except Exception as e:
        print(f"\n❌ Hata oluştu: {e}")
        import traceback
        traceback.print_exc()
        input("Kapanmak için ENTER'a basın...")
        sys.exit()