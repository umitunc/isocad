import React from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  History,
  Layers as LayersIcon,
  Trash2,
} from 'lucide-react';
import { CadLayer } from '../../core/layers/LayerManager';
import { ICadEntity } from '../../core/interfaces/ICadEntity';
import { useLocaleStore } from '../../i18n/useLocaleStore';
import { SampleManifestItem, useEditorStore } from '../../store/useEditorStore';
import { StampPreviewSvg } from './StampPreviewSvg';

interface RightInspectorSidebarProps {
  samples: SampleManifestItem[];
  layers: CadLayer[];
  entities: ICadEntity[];
  selectedIds: Set<string>;
  onSelectSample: (sample: SampleManifestItem) => void;
  onAddStampFromSidebar: () => void;
  onToggleLayerVis: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onDeleteEntity: (id: string) => void;
  onRestoreVersion: (version: number) => void;
}

export const RightInspectorSidebar: React.FC<RightInspectorSidebarProps> = ({
  samples,
  layers,
  entities,
  selectedIds,
  onSelectSample,
  onAddStampFromSidebar,
  onToggleLayerVis,
  onToggleLayerLock,
  onSelectEntity,
  onDeleteEntity,
  onRestoreVersion,
}) => {
  const { t } = useLocaleStore();
  const {
    sidebarOpen,
    drawingType,
    activePdfUrl,
    editMode,
    strokeColor,
    selectedSpool,
    selectedJoint,
    selectedWelder,
    spools,
    welders,
    versions,
    activeVersion,
    setField,
  } = useEditorStore();

  return (
    <aside
      className={`relative border-l border-slate-800 bg-[#0b1120] text-slate-200 transition-all duration-200 flex flex-col shrink-0 ${
        sidebarOpen ? 'w-80' : 'w-0 overflow-visible'
      }`}
    >
      <button
        type="button"
        onClick={() => setField('sidebarOpen', !sidebarOpen)}
        className="absolute -left-7 top-5 z-20 flex h-10 w-7 items-center justify-center rounded-l-lg border border-r-0 border-slate-700 bg-[#0b1120] text-slate-400 hover:text-cyan-300 cursor-pointer"
        title="Toggle Inspector"
      >
        {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
          {/* Drawing Selection */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.editor.drawingSelection}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t.editor.drawingType}
              </label>
              <select
                value={drawingType}
                onChange={(e) =>
                  setField('drawingType', e.target.value as 'engineering' | 'spool' | 'as_build')
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5"
              >
                <option value="engineering">Engineering Drawing</option>
                <option value="spool">Spool Drawing</option>
                <option value="as_build">As-Build Drawing</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t.editor.pdfFile}</label>
              <select
                value={activePdfUrl}
                onChange={(e) => {
                  const found = samples.find((s) => s.url === e.target.value);
                  if (found) onSelectSample(found);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px]"
              >
                {samples.map((s) => (
                  <option key={s.id} value={s.url}>
                    Rev {s.revision} — {s.drawingNo} {s.isLatest ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t.editor.editMode}</label>
              <select
                value={editMode}
                onChange={(e) =>
                  setField('editMode', e.target.value as 'cad' | 'joints' | 'joints_welder')
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5"
              >
                <option value="cad">{t.editor.modeCad}</option>
                <option value="joints">{t.editor.modeJoints}</option>
                <option value="joints_welder">{t.editor.modeJointsWelder}</option>
              </select>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Existing Weldmap Data */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              {t.editor.weldmapData}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t.editor.spoolNo}</label>
              <select
                value={selectedSpool}
                onChange={(e) => setField('selectedSpool', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono"
              >
                {spools.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t.editor.jointNo}</label>
              <input
                value={selectedJoint}
                onChange={(e) => setField('selectedJoint', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono"
              />
            </div>

            {editMode === 'joints_welder' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">{t.editor.welderId}</label>
                <select
                  value={selectedWelder}
                  onChange={(e) => setField('selectedWelder', e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono"
                >
                  <option value="">— None —</option>
                  {welders.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-center rounded border border-slate-800/80 bg-slate-950/70 py-2">
              <StampPreviewSvg
                shapeKind="triangle"
                color={strokeColor || '#ef4444'}
                primaryLabel={selectedJoint ? `F${selectedJoint}` : 'F?'}
                secondaryLabel={editMode === 'joints_welder' ? selectedWelder : ''}
              />
            </div>

            <button
              type="button"
              onClick={onAddStampFromSidebar}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.editor.addStamp}
            </button>
          </div>

          {/* CAD Layers */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <LayersIcon className="h-3 w-3" />
              {t.editor.layers} ({entities.length})
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 divide-y divide-slate-800/70">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between px-2.5 py-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="truncate text-[11px]">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleLayerVis(layer.id)}
                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-slate-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleLayerLock(layer.id)}
                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {layer.locked ? <Lock className="h-3 w-3 text-amber-400" /> : <Unlock className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {entities.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-1 space-y-1">
                {entities.slice(-15).reverse().map((ent) => (
                  <div
                    key={ent.id}
                    onClick={() => onSelectEntity(ent.id)}
                    className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer text-[11px] font-mono ${
                      selectedIds.has(ent.id)
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <span className="truncate">
                      {ent.type} ({ent.id.slice(0, 10)})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntity(ent.id);
                      }}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action / Version History */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <History className="h-3 w-3" />
              {t.editor.actionHistory}
            </div>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1.5">
              {versions.length === 0 ? (
                <div className="text-center text-slate-500 py-2">{t.editor.noActions}</div>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.version}
                    type="button"
                    onClick={() => onRestoreVersion(v.version)}
                    className={`w-full text-left rounded-md px-2.5 py-1.5 border transition-colors cursor-pointer ${
                      activeVersion === v.version
                        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Version {v.version}</span>
                      <span className="font-mono text-[10px] opacity-75">{v.timestamp}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {v.action} • {v.entitiesCount} obj
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
