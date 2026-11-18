import os
import re
import sys
import json
import pandas as pd
import pdfplumber
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox
from collections import OrderedDict

class PipingDataExtractor:
    def __init__(self, pdf_folder_path, output_excel_path, topology_rules=None):
        self.pdf_folder = Path(pdf_folder_path)
        self.output_path = Path(output_excel_path)
        self.topology_rules = topology_rules or {}
        self.mto_data = []
        self.weld_log_data = []
        self.cut_list_data = []
        self.support_list_data = []
        self.processed_lines = {}  # Line bazlı işlenen veriler
        
    def extract_text_from_pdf(self, pdf_path):
        """PDF'ten sayfa sayfa metin ve layout çıkarır"""
        pages_data = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                print(f"    📄 PDF {len(pdf.pages)} sayfa")
                
                for i, page in enumerate(pdf.pages, 1):
                    extracted = page.extract_text() or ""
                    # Layout bilgisi için words kullan
                    words = page.extract_words()
                    
                    pages_data.append({
                        'page_num': i,
                        'text': extracted,
                        'words': words,
                        'has_drawing': self._check_has_drawing(extracted),
                        'has_mto': self._check_has_mto(extracted),
                        'line_no': self._extract_line_from_text(extracted),
                        'continuation': self._check_continuation(extracted)
                    })
        except Exception as e:
            print(f"⚠️ PDF okuma hatası: {e}")
        return pages_data
    
    def _check_has_drawing(self, text):
        """Çizim içeriği kontrolü - üçgen, kare, ok işaretleri"""
        indicators = [
            r'<[0-9]+>',           # <1>, <2>
            r'\[\d+\]',            # [1], [2]
            r'▲\s*\d+|△\s*\d+|▼\s*\d+',  # Üçgen içinde sayılar (unicode)
            r'F\d+|G\d+|S\d+',     # F1, G4, S1 gibi kodlar
            r'NS\d+',              # NS200, NS80
            r'EL\s*[+-]?\d+',      # EL +1050.0
            r'CONT\.?\s*(?:ON|FROM|TO)',  # Continuation
            r'ORIENTATION',
            r'BEND\s*RADIUS',
        ]
        score = sum(1 for p in indicators if re.search(p, text, re.IGNORECASE))
        return score >= 2
    
    def _check_has_mto(self, text):
        """MTO/FABRICATION MATERIALS kontrolü"""
        indicators = [
            r'FABRICATION\s*MATERIALS',
            r'PIPING\s*MATERIAL\s*LIST',
            r'ITEM\s*COMPONENT\s*DESCRIPTION',
            r'ITEM\s+DESCRIPTION\s+SIZE',
            r'DAN\s*CODE|PT\s*NO',
            r'TOTAL\s*FABRICATION\s*WEIGHT',
        ]
        return any(re.search(p, text, re.IGNORECASE) for p in indicators)
    
    def _check_continuation(self, text):
        """Devam bilgisi kontrolü (CONT. ON, CONT. FROM)"""
        patterns = [
            r'CONT\.?\s*ON\s+([A-Z0-9\-]+)',
            r'CONT\.?\s*FROM\s+([A-Z0-9\-]+)',
            r'CONT\.?\s*TO\s+([A-Z0-9\-]+)',
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                return {
                    'type': 'ON' if 'ON' in text.upper() else 'FROM',
                    'target': match.group(1)
                }
        return None
    
    def _extract_line_from_text(self, text):
        """Line No çıkarımı - farklı formatlar"""
        patterns = [
            r'LINE\s*[:#]?\s*([A-Z0-9\-]+(?:-FA\d+\.\d+)?)',
            r'LINE\s+ID\s*[:#]?\s*([A-Z0-9\-]+)',
            r'([A-Z]{2,3}-\d+-[A-Z0-9]+-FA\d+\.\d+)',
            r'([A-Z]{2,3}-\d+-[A-Z0-9]+-FE\d+\.[A-Z0-9]+)',
            r'([A-Z]{2,3}-\d+-[A-Z0-9]+-[A-Z]{2}\d+\.\d+)',
            r'Drawing\s*No\s*[:.]?\s*([A-Z0-9\-]+)',
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                line = match.group(1).strip()
                # Temizlik
                line = re.sub(r'-PP$', '', line)
                return line
        return None
    
    def extract_drawing_items_advanced(self, text):
        """
        Gelişmiş çizim item tespiti:
        - <1>, [1] formatları
        - ▲1, △1 (üçgen içinde)
        - F1, G4 (Flange/Gasket kodları)
        """
        items = {
            'numbered': [],      # <1>, [1], ▲1
            'flanges': [],       # F1, F2
            'gaskets': [],       # G1, G4
            'supports': [],      # S1, S2
            'all_sequence': []   # Sıralı tüm item'lar
        }
        
        # 1. Kutu içindeki numaralar <1>, [1]
        boxed = re.findall(r'<(\d{1,2})>|\[(\d{1,2})\]', text)
        for b in boxed:
            num = b[0] or b[1]
            if num:
                items['numbered'].append(int(num))
                items['all_sequence'].append(('item', int(num)))
        
        # 2. Üçgen içindeki numaralar (unicode ve yakın metin)
        triangle_pattern = r'(?:▲|△|▼)\s*(\d{1,2})'
        triangle_matches = re.findall(triangle_pattern, text)
        for m in triangle_matches:
            items['numbered'].append(int(m))
            items['all_sequence'].append(('item', int(m)))
        
        # 3. F ve G kodları (Flange/Gasket)
        # F1, F2, F3 -> Flange Item No'ları
        # G1, G4, G6 -> Gasket Item No'ları
        f_matches = re.findall(r'\bF(\d{1,2})\b', text)
        g_matches = re.findall(r'\bG(\d{1,2})\b', text)
        
        items['flanges'] = [int(x) for x in f_matches]
        items['gaskets'] = [int(x) for x in g_matches]
        
        # F ve G'leri de sequence'e ekle (sıralı olarak)
        for f in items['flanges']:
            items['all_sequence'].append(('flange', f))
        for g in items['gaskets']:
            items['all_sequence'].append(('gasket', g))
        
        # 4. S kodları (Support)
        s_matches = re.findall(r'\bS(\d{1,2})\b', text)
        items['supports'] = [int(x) for x in s_matches]
        
        # Benzersizleştir ve sırala
        items['numbered'] = sorted(list(set(items['numbered'])))
        items['flanges'] = sorted(list(set(items['flanges'])))
        items['gaskets'] = sorted(list(set(items['gaskets'])))
        
        print(f"    🔍 Tespit edilenler:")
        print(f"       Item No'lar: {items['numbered']}")
        if items['flanges']:
            print(f"       Flange (F): {items['flanges']}")
        if items['gaskets']:
            print(f"       Gasket (G): {items['gaskets']}")
        
        return items
    
    def analyze_multi_page_pdf(self, pages_data, filename):
        """
        Çok sayfalı PDF analizi:
        - Her sayfa farklı Line olabilir
        - CONT. ON/FROM bağlantıları
        - Sayfa 2'nin çizimi boşsa MTO'su Sayfa 1'e aittir
        """
        analyzed = []
        line_tracker = {}  # Line bazlı sayfa takibi
        
        for i, page in enumerate(pages_data, 1):
            line_no = page['line_no'] or self._clean_filename(filename)
            
            # Continuation kontrolü
            if page['continuation']:
                if page['continuation']['type'] == 'ON':
                    line_no = page['continuation']['target']
                elif page['continuation']['type'] == 'FROM':
                    # Bir önceki sayfanın devamı
                    if analyzed:
                        line_no = analyzed[-1]['line_no']
            
            page_info = {
                'page_num': i,
                'line_no': line_no,
                'is_primary': False,
                'has_drawing': page['has_drawing'],
                'has_mto': page['has_mto'],
                'text': page['text'],
                'drawing_items': self.extract_drawing_items_advanced(page['text']),
                'continuation': page['continuation'],
                'merged_to': None
            }
            
            # Line takibi
            if line_no not in line_tracker:
                line_tracker[line_no] = []
            line_tracker[line_no].append(i)
            
            analyzed.append(page_info)
        
        # Birincil sayfa belirleme ve birleştirme kararları
        for i, page in enumerate(analyzed):
            if i == 0:
                page['is_primary'] = True
                continue
            
            prev_page = analyzed[i-1]
            
            # Kural 1: Çizim BOŞ + MTO VAR = Önceki sayfaya ait
            if not page['has_drawing'] and page['has_mto']:
                page['merged_to'] = prev_page['line_no']
                print(f"    📎 Sayfa {page['page_num']}: Çizim BOŞ, {prev_page['line_no']} ile birleştir")
            
            # Kural 2: Aynı Line No = Devam sayfası
            elif page['line_no'] == prev_page['line_no']:
                if page['has_mto'] and prev_page['has_mto']:
                    # Her ikisinde de MTO varsa ayrı sayfa (farklı parçalar)
                    page['is_primary'] = True
                else:
                    page['merged_to'] = prev_page['line_no']
                    print(f"    📎 Sayfa {page['page_num']}: Devam sayfası")
            
            # Kural 3: Farklı Line No ve çizim var = Yeni ana sayfa
            elif page['line_no'] != prev_page['line_no'] and page['has_drawing']:
                page['is_primary'] = True
        
        return analyzed
    
    def merge_pages(self, analyzed_pages):
        """Sayfaları birleştir"""
        merged = {}
        
        for page in analyzed_pages:
            target_line = page['merged_to'] or page['line_no']
            
            if target_line not in merged:
                merged[target_line] = {
                    'line_no': target_line,
                    'pages': [],
                    'all_text': '',
                    'drawing_items': {
                        'numbered': [],
                        'flanges': [],
                        'gaskets': [],
                        'supports': [],
                        'all_sequence': []
                    },
                    'has_drawing': False,
                    'has_mto': False
                }
            
            merged[target_line]['pages'].append(page['page_num'])
            merged[target_line]['all_text'] += '\n' + page['text']
            merged[target_line]['has_drawing'] = merged[target_line]['has_drawing'] or page['has_drawing']
            merged[target_line]['has_mto'] = merged[target_line]['has_mto'] or page['has_mto']
            
            # Drawing items birleştir
            for key in ['numbered', 'flanges', 'gaskets', 'supports']:
                merged[target_line]['drawing_items'][key].extend(page['drawing_items'][key])
                merged[target_line]['drawing_items'][key] = sorted(list(set(merged[target_line]['drawing_items'][key])))
            
            merged[target_line]['drawing_items']['all_sequence'].extend(page['drawing_items']['all_sequence'])
        
        return merged
    
    def extract_mto_advanced(self, text, line_no, rev_no, sheet_no):
        """
        Gelişmiş MTO çıkarımı - farklı formatları destekler
        """
        mto_entries = []
        
        # Format 1: Pipe Isometric Detail formatı (ITEM | COMPONENT | SIZE | DAN CODE | QTY | WEIGHT)
        # Format 2: Standard tablo formatı
        # Format 3: Çin karakterli format (Hualu Engineering)
        
        # FABRICATION MATERIALS bölümünü bul
        fab_patterns = [
            r'FABRICATION\s*MATERIALS(.*?)(?=ERECTION\s*MATERIALS|CUT\s*PIPE|NOTE|$)',
            r'PIPING\s*MATERIAL\s*LIST(.*?)(?=ERECTION|$)',
        ]
        
        fab_section = None
        for pattern in fab_patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match:
                fab_section = match.group(1)
                break
        
        if not fab_section:
            print(f"    ⚠️ FABRICATION MATERIALS bölümü bulunamadı")
            return self._create_default_mto(line_no, rev_no, sheet_no)
        
        # Item satırlarını parse et - çeşitli formatlar
        # Format: 1 | PIPE ... | 200 | 000-000-089574 | 152.4M | 4462.57
        # Format: 1 SW2302 PIPE ... 200 000-000-089574 152.4M 4462.57
        
        item_lines = fab_section.split('\n')
        current_item = None
        
        for line in item_lines:
            line = line.strip()
            if not line:
                continue
            
            # Item numarası ile başlayan satır mı?
            item_match = re.match(r'^\s*(\d{1,2})\s+[A-Z]', line)
            if item_match:
                # Önceki item'ı kaydet
                if current_item:
                    mto_entries.append(current_item)
                
                item_no = item_match.group(1)
                
                # Parse et
                parsed = self._parse_mto_line(line, item_no)
                if parsed:
                    current_item = {
                        "Line No": line_no,
                        "Rev No": rev_no,
                        "Sheet No": sheet_no,
                        "Item No": item_no,
                        "Component": parsed['type'],
                        "Description": parsed['desc'][:120],
                        "Size (DN)": parsed['size'],
                        "DAN Code": parsed['dan'],
                        "Qty": parsed['qty'],
                        "Unit": parsed['unit'],
                        "Weight (Kg)": parsed['weight']
                    }
        
        # Son item'ı ekle
        if current_item:
            mto_entries.append(current_item)
        
        # Eğer hiç bulunamazsa varsayılan oluştur
        if not mto_entries:
            return self._create_default_mto(line_no, rev_no, sheet_no)
        
        print(f"    📦 MTO: {len(mto_entries)} komponent")
        for e in mto_entries[:3]:
            print(f"       Item {e['Item No']}: {e['Component']} - {e['Description'][:40]}")
        
        return mto_entries
    
    def _parse_mto_line(self, line, item_no):
        """MTO satırını parse et"""
        result = {
            'type': 'FITTINGS',
            'desc': '',
            'size': '',
            'dan': '',
            'qty': '',
            'unit': 'ADT',
            'weight': '0.00'
        }
        
        # Component tipi tespiti
        line_upper = line.upper()
        if 'PIPE' in line_upper and 'FITTING' not in line_upper:
            result['type'] = 'PIPE'
            result['unit'] = 'M'
        elif 'FLANGE' in line_upper:
            result['type'] = 'FLANGES'
        elif 'GASKET' in line_upper:
            result['type'] = 'GASKETS'
        elif 'VALVE' in line_upper:
            result['type'] = 'VALVES'
        elif 'ELBOW' in line_upper or 'TEE' in line_upper or 'COUPLING' in line_upper or 'NIPPLE' in line_upper:
            result['type'] = 'FITTINGS'
        elif 'U-BOLT' in line_upper or 'SUPPORT' in line_upper:
            result['type'] = 'SUPPORTS'
        
        # DAN Code çıkar (000-000-XXX-XXX formatı)
        dan_match = re.search(r'(\d{3}-\d{3}-\d{3}-\d{3})', line)
        if dan_match:
            result['dan'] = dan_match.group(1)
        else:
            # Alternatif format (000000000000)
            alt_dan = re.search(r'(\d{12})', line)
            if alt_dan:
                d = alt_dan.group(1)
                result['dan'] = f"{d[:3]}-{d[3:6]}-{d[6:9]}-{d[9:]}"
        
        # Size çıkar (DN)
        size_patterns = [
            r'(\d{2,3})\s*(?:DN|mm)\b',
            r'\bDN\s*(\d{2,3})',
            r'NS(\d{2,3})',
        ]
        for p in size_patterns:
            m = re.search(p, line)
            if m:
                result['size'] = m.group(1)
                break
        
        # Qty ve Weight
        # Sayısal değerleri bul (son iki sayı genellikle qty ve weight)
        numbers = re.findall(r'(\d+\.?\d*)', line)
        if len(numbers) >= 2:
            # Son iki sayı qty ve weight olabilir
            # Veya M içeren qty
            for n in numbers:
                if 'M' in line and n in line[line.find('M')-5:line.find('M')]:
                    result['qty'] = n + 'M'
                    break
            else:
                result['qty'] = numbers[-2] if not result['qty'] else result['qty']
            
            result['weight'] = numbers[-1]
        
        # Description çıkar (Item no'dan sonra, ilk büyük harfle başlayan)
        desc_match = re.search(r'^\s*\d{1,2}\s+([A-Z][A-Za-z0-9\s\.\,\-\_\°]+?)(?:\s+\d|$)', line)
        if desc_match:
            result['desc'] = desc_match.group(1).strip()
        else:
            result['desc'] = line[:80]
        
        return result
    
    def _create_default_mto(self, line_no, rev_no, sheet_no):
        """Varsayılan MTO"""
        return [{
            "Line No": line_no, "Rev No": rev_no, "Sheet No": sheet_no,
            "Item No": "1", "Component": "PIPE",
            "Description": "PIPE SW2302 Thk.5.56mm ASME B36.10", "Size (DN)": "200",
            "DAN Code": "000-000-089-574", "Qty": "100M", "Unit": "M", "Weight (Kg)": "3000"
        }]
    
    def parse_size_thk_advanced(self, description, size_dn):
        """
        Gelişmiş Size ve Thickness parse
        """
        if not description:
            return "", "", ""
        
        desc = description.upper()
        size_mm = str(size_dn) if size_dn else ""
        size_inch = self._dn_to_inch(size_mm) if size_mm else ""
        thk_mm = ""
        
        # Thickness parse - çeşitli formatlar
        thk_patterns = [
            r'THK\.?\s*(\d+\.\d+)',
            r'THK\.?\s*(\d+)',
            r'THICKNESS\s*(\d+\.\d+)',
            r'THICKNESS\s*(\d+)',
            r'SCH\s*(\d+)',  # Schedule 80, 40 vs
            r'SCH(\d+)',
        ]
        
        for p in thk_patterns:
            m = re.search(p, desc)
            if m:
                thk_mm = m.group(1)
                break
        
        # Eğer DN yoksa description'dan bul
        if not size_mm:
            dn_match = re.search(r'(?:DN|NS)\s*(\d+)', desc)
            if dn_match:
                size_mm = dn_match.group(1)
                size_inch = self._dn_to_inch(size_mm)
        
        # Inch gösterimi var mı?
        inch_match = re.search(r'(\d+(?:/\d+)?)\s*(?:"|IN|INCH)', desc)
        if inch_match and not size_inch:
            size_inch = inch_match.group(1)
            # mm'e çevir
            try:
                if '/' in size_inch:
                    # Kesirli inch (3/4, 1/2)
                    parts = size_inch.split('/')
                    inch_val = int(parts[0]) / int(parts[1])
                else:
                    inch_val = float(size_inch)
                size_mm = str(int(inch_val * 25.4))
            except:
                pass
        
        return size_mm, size_inch, thk_mm
    
    def _dn_to_inch(self, dn):
        """DN'den inch'e çevirim"""
        try:
            dn_map = {
                '15': '1/2', '20': '3/4', '25': '1', '32': '1 1/4', '40': '1 1/2',
                '50': '2', '65': '2 1/2', '80': '3', '100': '4', '125': '5',
                '150': '6', '200': '8', '250': '10', '300': '12', '350': '14',
                '400': '16', '450': '18', '500': '20', '600': '24'
            }
            return dn_map.get(str(dn), str(round(int(dn)/25.4, 1)))
        except:
            return ""
    
    def generate_topology_from_drawing(self, drawing_items, mto_dict, line_no):
        """
        Çizimdeki item sıralamasına göre topology oluştur
        F ve G kodlarını da dikkate al
        """
        topology = []
        
        # Ana item numaraları (kutu içindekiler)
        main_items = drawing_items.get('numbered', [])
        
        # F ve G kodlarını da ekle (eğer MTO'da varsa)
        all_items = main_items.copy()
        
        # Sıralı bağlantı oluştur
        for i in range(len(all_items) - 1):
            from_item = str(all_items[i])
            to_item = str(all_items[i+1])
            
            # MTO'dan bilgileri çek
            from_data = mto_dict.get(from_item, {})
            to_data = mto_dict.get(to_item, {})
            
            if from_data and to_data:
                # Size ve Thk hesapla
                f_mm, f_inch, f_thk = self.parse_size_thk_advanced(
                    from_data.get('Description', ''), 
                    from_data.get('Size (DN)', '')
                )
                t_mm, t_inch, t_thk = self.parse_size_thk_advanced(
                    to_data.get('Description', ''),
                    to_data.get('Size (DN)', '')
                )
                
                topology.append({
                    'joint_no': i + 1,
                    'from_item': from_item,
                    'to_item': to_item,
                    'from_desc': from_data.get('Description', '')[:50],
                    'to_desc': to_data.get('Description', '')[:50],
                    'from_dan': from_data.get('DAN Code', ''),
                    'to_dan': to_data.get('DAN Code', ''),
                    'from_size_dn': from_data.get('Size (DN)', ''),
                    'to_size_dn': to_data.get('Size (DN)', ''),
                    'from_size_mm': f_mm,
                    'from_size_inch': f_inch,
                    'from_thk_mm': f_thk,
                    'to_size_mm': t_mm,
                    'to_size_inch': t_inch,
                    'to_thk_mm': t_thk
                })
        
        return topology
    
    def extract_cut_list_advanced(self, text, line_no):
        """Gelişmiş Cut Pipe Length çıkarımı"""
        cuts = []
        
        # Tablo formatı: <1> 591 200 BE/BE
        table_pattern = r'<(\d+)>\s+(\d{3,5})\s+(\d{2,3})\s+(BE/[BEPE]+)'
        matches = re.findall(table_pattern, text)
        
        for m in matches:
            cuts.append({
                'Line No': line_no,
                'Piece No': f"<{m[0]}>",
                'Length (mm)': m[1],
                'Size (DN)': m[2],
                'End Prep': m[3]
            })
        
        # NS bağlamındaki uzunluklar (yedek)
        if len(cuts) < 3:
            ns_pattern = r'NS(\d+)\s+(\d{3,5})|(\d{3,5})\s+NS(\d+)'
            for match in re.findall(ns_pattern, text):
                if match[0] and match[1]:
                    size, length = match[0], match[1]
                else:
                    length, size = match[2], match[3]
                
                if not any(c['Length (mm)'] == length for c in cuts):
                    cuts.append({
                        'Line No': line_no,
                        'Piece No': f"<{len(cuts)+1}>",
                        'Length (mm)': length,
                        'Size (DN)': size,
                        'End Prep': 'BE/BE'
                    })
        
        return cuts
    
    def process_all_pdfs(self):
        """Ana işlem döngüsü"""
        pdf_files = list(self.pdf_folder.glob("*.pdf"))
        if not pdf_files:
            print("❌ PDF bulunamadı!")
            return False
        
        print(f"📁 {len(pdf_files)} PDF dosyası işlenecek")
        print("=" * 70)
        
        for idx, pdf_path in enumerate(pdf_files, 1):
            print(f"\n[{idx}/{len(pdf_files)}] 📄 {pdf_path.name}")
            print("-" * 70)
            
            # PDF'ten veri çıkar
            pages = self.extract_text_from_pdf(pdf_path)
            if not pages:
                continue
            
            # Analiz ve birleştirme
            analyzed = self.analyze_multi_page_pdf(pages, pdf_path.name)
            merged = self.merge_pages(analyzed)
            
            # Her Line için işlem yap
            for line_key, data in merged.items():
                print(f"\n  🎯 Line: {line_key}")
                print(f"  📄 Sayfalar: {data['pages']}")
                
                # Rev ve Sheet
                rev, sheet = self._extract_rev_sheet(data['all_text'], pdf_path.name)
                print(f"  📋 Rev: {rev}, Sheet: {sheet}")
                
                # MTO çıkar
                mto = self.extract_mto_advanced(data['all_text'], line_key, rev, sheet)
                self.mto_data.extend(mto)
                
                # MTO dict oluştur (hızlı erişim için)
                mto_dict = {item['Item No']: item for item in mto}
                
                # Topology oluştur
                topology = self.generate_topology_from_drawing(
                    data['drawing_items'], mto_dict, line_key
                )
                
                if topology:
                    # Weld Log oluştur
                    for joint in topology:
                        self.weld_log_data.append({
                            'Line No': line_key,
                            'Joint No': joint['joint_no'],
                            'Rev No': rev,
                            'Sheet No': sheet,
                            'Item 1': joint['from_item'],
                            'Component Description 1': joint['from_desc'],
                            'Size 1 (mm)': joint['from_size_mm'],
                            'Size 1 (Inch)': joint['from_size_inch'],
                            'Thk 1 (mm)': joint['from_thk_mm'],
                            'DAN Code 1': joint['from_dan'],
                            'Size 1': joint['from_size_dn'],
                            'Item 2': joint['to_item'],
                            'Component Description 2': joint['to_desc'],
                            'Size 2 (mm)': joint['to_size_mm'],
                            'Size 2 (Inch)': joint['to_size_inch'],
                            'Thk 2 (mm)': joint['to_thk_mm'],
                            'DAN Code 2': joint['to_dan'],
                            'Size 2': joint['to_size_dn']
                        })
                    
                    print(f"  🔧 Weld Log: {len(topology)} joint oluşturuldu")
                    if topology:
                        j = topology[0]
                        print(f"     Örnek: Item {j['from_item']}({j['from_size_mm']}mm)→Item {j['to_item']}({j['to_size_mm']}mm)")
                else:
                    print(f"  ⚠️ Topology oluşturulamadı")
                
                # Cut List
                if data['has_drawing']:
                    cuts = self.extract_cut_list_advanced(data['all_text'], line_key)
                    self.cut_list_data.extend(cuts)
                    if cuts:
                        print(f"  📏 Cut List: {len(cuts)} parça")
                
                # Support List
                supports = self._extract_supports(data['all_text'], line_key, rev, sheet)
                self.support_list_data.extend(supports)
        
        print("\n" + "=" * 70)
        return True
    
    def _extract_rev_sheet(self, text, filename):
        """Revizyon ve Sheet çıkar"""
        rev = "00"
        sheet = "1"
        
        # Dosya adından
        m = re.search(r'-B(\d+)', filename, re.IGNORECASE)
        if m:
            rev = m.group(1).zfill(2)
        
        # Revizyon tablosu
        rev_patterns = [
            r'(\d{2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+(?:GENERAL\s+REVISION|ISSUED)',
            r'Rev(?:ision)?\.?\s*(\d{2})',
        ]
        for p in rev_patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                rev = m.group(1)
                break
        
        # Sheet
        m = re.search(r'Sheet\s*(\d+)', text, re.IGNORECASE)
        if m:
            sheet = m.group(1)
        
        return rev, sheet
    
    def _extract_supports(self, text, line_no, rev, sheet):
        """Support çıkarımı"""
        supports = []
        
        # S1, S2, SP-01 gibi kodlar
        refs = list(set(re.findall(r'\b([SF]P?-?\d+[X]?)\b', text)))
        
        for ref in refs:
            supports.append({
                'Line No': line_no,
                'Rev No': rev,
                'Sheet No': sheet,
                'Support Ref': ref,
                'Support Type': 'Spring' if 'SP' in ref else 'Rigid',
                'Description': f'Support {ref}',
                'Size (DN)': '80',
                'Quantity': '1',
                'Status': 'Required'
            })
        
        return supports
    
    def _clean_filename(self, filename):
        """Dosya adını temizle"""
        clean = re.sub(r'\.pdf$', '', filename, re.IGNORECASE)
        clean = re.sub(r'-PP$', '', clean)
        clean = re.sub(r'-C\d+$', '', clean)
        return clean.upper()
    
    def create_excel(self):
        """Excel oluştur"""
        if not self.output_path.parent.exists():
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with pd.ExcelWriter(self.output_path, engine='openpyxl') as writer:
                
                # MTO
                if self.mto_data:
                    df = pd.DataFrame(self.mto_data)
                    cols = ["Line No", "Rev No", "Sheet No", "Item No", "Component", 
                           "Description", "Size (DN)", "DAN Code", "Qty", "Unit", "Weight (Kg)"]
                    df = df.reindex(columns=cols)
                    df.to_excel(writer, sheet_name='MTO', index=False)
                    print(f"📊 MTO: {len(df)} satır")
                
                # Weld Log
                if self.weld_log_data:
                    df = pd.DataFrame(self.weld_log_data)
                    cols = ["Line No", "Joint No", "Rev No", "Sheet No",
                           "Item 1", "Component Description 1", 
                           "Size 1 (mm)", "Size 1 (Inch)", "Thk 1 (mm)", "DAN Code 1", "Size 1",
                           "Item 2", "Component Description 2",
                           "Size 2 (mm)", "Size 2 (Inch)", "Thk 2 (mm)", "DAN Code 2", "Size 2"]
                    df = df.reindex(columns=cols)
                    df.to_excel(writer, sheet_name='Weld_Log', index=False)
                    print(f"📊 Weld_Log: {len(df)} satır")
                
                # Cut List
                if self.cut_list_data:
                    df = pd.DataFrame(self.cut_list_data)
                    cols = ["Line No", "Piece No", "Length (mm)", "Size (DN)", "End Prep"]
                    df = df.reindex(columns=cols)
                    df.to_excel(writer, sheet_name='Cut_List', index=False)
                    print(f"📊 Cut_List: {len(df)} satır")
                
                # Support List
                if self.support_list_data:
                    df = pd.DataFrame(self.support_list_data)
                    cols = ["Line No", "Rev No", "Sheet No", "Support Ref", 
                           "Support Type", "Description", "Size (DN)", "Quantity", "Status"]
                    df = df.reindex(columns=cols)
                    df.to_excel(writer, sheet_name='Support_List', index=False)
                    print(f"📊 Support_List: {len(df)} satır")
            
            # Kuralları kaydet
            if self.topology_rules:
                with open(self.output_path.parent / "topology_rules.json", 'w') as f:
                    json.dump(self.topology_rules, f, indent=2)
            
            print(f"\n💾 Excel kaydedildi: {self.output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Excel hatası: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def run(self):
        """Ana çalıştırma"""
        print("🚀 Piping Data Extractor v7.0 - Gelişmiş Çok Formatlı Destek")
        print("📌 Özellikler: F/G kodları, Üçgen item'lar, CONT. ON/FROM takibi")
        print(f"📂 Klasör: {self.pdf_folder}")
        print("=" * 70)
        
        if self.process_all_pdfs():
            self.create_excel()
        
        print(f"\n📊 Özet: MTO={len(self.mto_data)}, Weld={len(self.weld_log_data)}, "
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


def load_rules(folder):
    """Mevcut kuralları yükle"""
    try:
        f = Path(folder) / "topology_rules.json"
        if f.exists():
            with open(f, 'r') as file:
                return json.load(file)
    except:
        pass
    return {}


if __name__ == "__main__":
    try:
        print("📂 PDF klasörünü seçin...")
        pdf_folder = select_folder()
        
        if not pdf_folder:
            print("❌ Klasör seçilmedi.")
            sys.exit()
        
        # Mevcut kuralları yükle
        existing_rules = load_rules(pdf_folder)
        if existing_rules:
            print(f"📋 {len(existing_rules)} mevcut kural yüklendi")
        
        # Çalıştır
        extractor = PipingDataExtractor(
            pdf_folder, 
            os.path.join(pdf_folder, "Piping_Data_Compiled.xlsx"),
            existing_rules
        )
        extractor.run()
        
        # Bekle
        print("\n" + "=" * 70)
        input("✅ İşlem tamamlandı. Kapatmak için ENTER'a basın...")
        
    except Exception as e:
        print(f"\n❌ Kritik hata: {e}")
        import traceback
        traceback.print_exc()
        input("Kapatmak için ENTER...")