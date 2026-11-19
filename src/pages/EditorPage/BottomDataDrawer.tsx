import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, Table2 } from 'lucide-react';
import {
  SheetGL,
  appleDark,
  appleLight,
  type ColumnDef,
  type GridPermissions,
  type GridToolbarConfig,
  type IGridThemeTokens,
} from 'sheetgl';
import { useLocaleStore } from '../../i18n/useLocaleStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useThemeStore } from '../../store/useThemeStore';

interface BottomDataDrawerProps {
  onFocusWorldPoint: (pt: { x: number; y: number }) => void;
  onExportExcel: () => void;
}

const ISOCAD_DARK_THEME: IGridThemeTokens = {
  ...appleDark,
  name: 'isocad-dark',
  isDark: true,
  canvas: {
    ...appleDark.canvas,
    bg: '#090d16',
    zebraRowBg: '#0c1220',
    rowHoverBg: 'rgba(34, 211, 238, 0.08)',
    gridLine: '#1e293b',
    headerBg: '#0b1120',
    headerText: '#cbd5e1',
    headerBorder: '#1e293b',
    cellText: '#e2e8f0',
    rowNumberBg: '#0b1120',
    rowNumberText: '#64748b',
    rowNumberBorder: '#1e293b',
    groupRowBg: '#0f172a',
    groupRowText: '#e2e8f0',
    groupRowBorder: '#1e293b',
    selectionBorder: '#06b6d4',
    selectionFill: 'rgba(6, 182, 212, 0.14)',
    fillHandleColor: '#22d3ee',
  },
  dom: {
    ...appleDark.dom,
    toolbarBg: '#0b1120',
    toolbarBorder: '#1e293b',
    toolbarText: '#e2e8f0',
    popoverBg: '#0b1120',
    popoverBorder: '#334155',
    popoverText: '#e2e8f0',
    inputBg: '#0f172a',
    inputText: '#f1f5f9',
    inputBorder: '#334155',
    inputFocusBorder: '#06b6d4',
    accentColor: '#06b6d4',
    buttonHoverBg: '#1e293b',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeText: '#67e8f9',
  },
};

const ISOCAD_LIGHT_THEME: IGridThemeTokens = {
  ...appleLight,
  name: 'isocad-light',
  isDark: false,
  canvas: {
    ...appleLight.canvas,
    rowHoverBg: 'rgba(6, 182, 212, 0.07)',
    selectionBorder: '#0891b2',
    selectionFill: 'rgba(6, 182, 212, 0.12)',
    fillHandleColor: '#0891b2',
  },
  dom: {
    ...appleLight.dom,
    inputFocusBorder: '#0891b2',
    accentColor: '#0891b2',
    badgeBg: 'rgba(6, 182, 212, 0.14)',
    badgeText: '#0e7490',
  },
};

const READONLY_PERMISSIONS: GridPermissions = {
  mode: 'readonly',
  allowAdding: false,
  allowUpdating: false,
  allowDeleting: false,
  allowDuplicating: false,
  allowClipboardPaste: false,
  allowBatchSave: false,
  allowFiltering: true,
  allowSorting: true,
  allowGrouping: true,
  allowExport: true,
};

const READONLY_TOOLBAR: GridToolbarConfig = {
  visible: false,
  buttonDisplayMode: 'icon',
  allowDisplayModeSwitch: false,
  showBrand: false,
  showAddRow: false,
  showDuplicateRow: false,
  showDeleteRow: false,
  showUndoRedo: false,
  showBatchActions: false,
  showSelectionModeSwitch: false,
  showPermissionsSwitch: false,
  showLocaleSwitch: false,
  showThemeSwitch: false,
  showSearch: true,
  showGroupBy: true,
  showClearFilters: true,
  showColumnSettings: true,
  showExportCsv: true,
  showExportExcel: true,
};

const MTO_COLUMNS: ColumnDef[] = [
  { id: 'itemNo', title: 'Item', type: 'text', width: 70, sortable: true, filterable: true, readonly: true },
  { id: 'component', title: 'Component', type: 'text', width: 120, sortable: true, filterable: true, readonly: true },
  { id: 'description', title: 'Description', type: 'text', width: 380, sortable: true, filterable: true, readonly: true },
  { id: 'sizeDn', title: 'DN', type: 'text', width: 80, sortable: true, filterable: true, readonly: true },
  { id: 'danCode', title: 'DAN Code', type: 'text', width: 140, sortable: true, filterable: true, readonly: true },
  { id: 'qtyDisplay', title: 'Qty', type: 'text', width: 110, sortable: true, filterable: true, readonly: true },
  { id: 'weight', title: 'Weight (Kg)', type: 'number', width: 110, sortable: true, filterable: true, readonly: true, summaryType: 'sum' },
];

const WELD_COLUMNS: ColumnDef[] = [
  { id: 'jointLabel', title: 'Joint #', type: 'text', width: 90, sortable: true, filterable: true, readonly: true },
  { id: 'item1', title: 'Item 1', type: 'text', width: 80, sortable: true, filterable: true, readonly: true },
  { id: 'desc1', title: 'Desc 1', type: 'text', width: 240, sortable: true, filterable: true, readonly: true },
  { id: 'size1Display', title: 'Size 1', type: 'text', width: 130, sortable: true, filterable: true, readonly: true },
  { id: 'thk1Display', title: 'Thk 1', type: 'text', width: 85, sortable: true, filterable: true, readonly: true },
  { id: 'item2', title: 'Item 2', type: 'text', width: 80, sortable: true, filterable: true, readonly: true },
  { id: 'desc2', title: 'Desc 2', type: 'text', width: 240, sortable: true, filterable: true, readonly: true },
  { id: 'danCode2', title: 'DAN 2', type: 'text', width: 130, sortable: true, filterable: true, readonly: true },
];

const CUT_COLUMNS: ColumnDef[] = [
  { id: 'pieceNo', title: 'Piece', type: 'text', width: 100, sortable: true, filterable: true, readonly: true },
  { id: 'length', title: 'Length (mm)', type: 'number', width: 130, sortable: true, filterable: true, readonly: true, summaryType: 'sum' },
  { id: 'sizeDn', title: 'DN', type: 'text', width: 90, sortable: true, filterable: true, readonly: true },
  { id: 'endPrep', title: 'End Prep', type: 'text', width: 140, sortable: true, filterable: true, readonly: true },
  { id: 'remarks', title: 'Remarks', type: 'text', width: 320, sortable: true, filterable: true, readonly: true },
];

const SUPPORT_COLUMNS: ColumnDef[] = [
  { id: 'supportRef', title: 'Support Ref', type: 'text', width: 130, sortable: true, filterable: true, readonly: true },
  { id: 'supportType', title: 'Type', type: 'text', width: 160, sortable: true, filterable: true, readonly: true },
  { id: 'description', title: 'Description', type: 'text', width: 340, sortable: true, filterable: true, readonly: true },
  { id: 'sizeDnDisplay', title: 'DN', type: 'text', width: 90, sortable: true, filterable: true, readonly: true },
  { id: 'quantity', title: 'Qty', type: 'number', width: 90, sortable: true, filterable: true, readonly: true, summaryType: 'sum' },
];

const MIN_DRAWER_HEIGHT = 140;
const DEFAULT_DRAWER_HEIGHT = 288;

export const BottomDataDrawer: React.FC<BottomDataDrawerProps> = ({
  onFocusWorldPoint,
  onExportExcel,
}) => {
  const { t, locale } = useLocaleStore();
  const { theme } = useThemeStore();
  const { pipingData, drawerOpen, drawerTab, setField } = useEditorStore();
  const [drawerHeight, setDrawerHeight] = useState(DEFAULT_DRAWER_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const startY = e.clientY;
      const startHeight = drawerHeight;
      setIsResizing(true);
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'ns-resize';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const maxHeight = Math.max(240, window.innerHeight - 160);
        const nextHeight = Math.min(
          maxHeight,
          Math.max(MIN_DRAWER_HEIGHT, startHeight + (startY - moveEvent.clientY)),
        );
        setDrawerHeight(nextHeight);
      };

      const cleanup = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', cleanup);
        document.body.style.cursor = prevCursor;
        setIsResizing(false);
        cleanupResizeRef.current = null;
      };

      cleanupResizeRef.current = cleanup;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', cleanup);
    },
    [drawerHeight],
  );

  const mtoCount = pipingData?.mto.length ?? 0;
  const weldCount = pipingData?.welds.length ?? 0;
  const cutCount = pipingData?.cuts.length ?? 0;
  const supCount = pipingData?.supports.length ?? 0;

  const { columns, rows } = useMemo(() => {
    if (!pipingData) {
      return { columns: MTO_COLUMNS, rows: [] as Record<string, any>[] };
    }
    if (drawerTab === 'mto') {
      return {
        columns: MTO_COLUMNS,
        rows: pipingData.mto.map((m, idx) => ({
          id: `mto-${idx}`,
          ...m,
          qtyDisplay: `${m.qty} ${m.unit}`,
        })),
      };
    }
    if (drawerTab === 'weld') {
      return {
        columns: WELD_COLUMNS,
        rows: pipingData.welds.map((w, idx) => ({
          id: `weld-${idx}`,
          ...w,
          jointLabel: `J-${w.jointNo}`,
          size1Display: `DN${w.size1Dn} (${w.size1Inch})`,
          thk1Display: w.thk1Mm || '-',
        })),
      };
    }
    if (drawerTab === 'cut') {
      return {
        columns: CUT_COLUMNS,
        rows: pipingData.cuts.map((c, idx) => ({
          id: `cut-${idx}`,
          ...c,
        })),
      };
    }
    return {
      columns: SUPPORT_COLUMNS,
      rows: pipingData.supports.map((s, idx) => ({
        id: `sup-${idx}`,
        ...s,
        sizeDnDisplay: s.sizeDn || '-',
      })),
    };
  }, [pipingData, drawerTab]);

  return (
    <div className="border-t border-slate-800 bg-[#0b1120] text-slate-200 select-none">
      {drawerOpen && (
        <div
          role="separator"
          aria-orientation="horizontal"
          onMouseDown={handleResizeStart}
          className={`group flex h-1.5 w-full cursor-ns-resize items-center justify-center transition-colors ${isResizing ? 'bg-cyan-500/40' : 'bg-slate-900/90 hover:bg-cyan-500/25'
            }`}
          title="Drag to resize height"
        >
          <div
            className={`h-0.5 w-10 rounded-full transition-colors ${isResizing ? 'bg-cyan-400' : 'bg-slate-700 group-hover:bg-cyan-400'
              }`}
          />
        </div>
      )}
      <div
        onClick={() => setField('drawerOpen', !drawerOpen)}
        className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 cursor-pointer"
        title="Toggle Data Drawer"
      >
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-cyan-400" />
          {(
            [
              ['mto', t.drawer.mto, mtoCount],
              ['weld', t.drawer.weldLog, weldCount],
              ['cut', t.drawer.cutList, cutCount],
              ['support', t.drawer.supports, supCount],
            ] as const
          ).map(([tabId, label, count]) => {
            const isActive = drawerOpen && drawerTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setField('drawerTab', tabId);
                  setField('drawerOpen', true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
              >
                <span>{label}</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none ${isActive
                      ? theme === 'light'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-cyan-500/30 text-cyan-200'
                      : theme === 'light'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExportExcel();
            }}
            className="inline-flex items-center gap-1 rounded bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 cursor-pointer"
          >
            <Download className="h-3 w-3" />
            {t.drawer.exportXlsx}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setField('drawerOpen', !drawerOpen);
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            title="Toggle Data Drawer"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${drawerOpen ? '' : 'rotate-180'}`}
            />
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div
          style={{ height: drawerHeight }}
          className="border-t border-slate-800/80 bg-[#090d16]"
        >
          {!pipingData ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              {t.drawer.emptyHint}
            </div>
          ) : (
            <div className="h-full w-full">
              <SheetGL
                key={drawerTab}
                dataSource={rows}
                columns={columns}
                keyField="id"
                theme={theme === 'dark' ? ISOCAD_DARK_THEME : ISOCAD_LIGHT_THEME}
                locale={locale === 'tr' ? 'tr' : 'en'}
                rowHeight={30}
                headerHeight={32}
                showFormulaBar={false}
                selectionMode="single"
                permissions={READONLY_PERMISSIONS}
                toolbar={READONLY_TOOLBAR}
                summaryRow={{
                  visible: true,
                  showTotalCount: true,
                  showSelectionStats: true,
                  showColumnSummaries: true,
                  allowConfiguration: true,
                }}
                onExport={onExportExcel}
                onCellClick={(e) => {
                  if (e.row?.anchorWorld) {
                    onFocusWorldPoint(e.row.anchorWorld);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
