import React, { useEffect, useState } from 'react';
import { X, Wrench, Save } from 'lucide-react';
import { WeldStampEntity } from '../../../core/entities/WeldStampEntity';
import { useLocaleStore } from '../../../i18n/useLocaleStore';
import { dnToInch, parseThk } from '../../../piping-domain/parsers/MaterialNormalizer';
import { JointWidgetMeta, MTOItem } from '../../../piping-domain/types/PipingModels';

interface JointWidgetModalProps {
  stamp: WeldStampEntity | null;
  mtoItems: MTOItem[];
  onClose: () => void;
  onSave: (stampId: string, updatedMeta: JointWidgetMeta) => void;
}

const WELD_TYPES = ['BW (Butt Weld)', 'SW (Socket Weld)', 'FW (Fillet Weld)', 'SOB (Slip-On)', 'TW (Tack)'];

export const JointWidgetModal: React.FC<JointWidgetModalProps> = ({
  stamp,
  mtoItems,
  onClose,
  onSave,
}) => {
  const { t } = useLocaleStore();
  const [form, setForm] = useState<JointWidgetMeta | null>(null);

  useEffect(() => {
    if (stamp) {
      setForm({ ...stamp.jointMeta });
    } else {
      setForm(null);
    }
  }, [stamp]);

  if (!stamp || !form) return null;

  const updateField = <K extends keyof JointWidgetMeta>(key: K, val: JointWidgetMeta[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: val };
      if (key === 'jointNo' || key === 'typeOfJoint') {
        next.drawJointNo = next.typeOfJoint ? `${next.typeOfJoint}${next.jointNo}` : next.jointNo;
      }
      return next;
    });
  };

  const handleMemberSelect = (slot: 1 | 2, desc: string) => {
    const mto = mtoItems.find((m) => m.description === desc);
    if (!mto) {
      updateField(slot === 1 ? 'member1' : 'member2', desc);
      return;
    }
    const thk = parseThk(mto.description);
    const inch = dnToInch(mto.sizeDn);
    setForm((prev) => {
      if (!prev) return prev;
      if (slot === 1) {
        return {
          ...prev,
          member1: desc,
          dia1: mto.sizeDn,
          nps1: inch,
          thickness1: thk,
          danCode1: mto.danCode,
          material: prev.material || (desc.includes('ASTM') ? desc.slice(desc.indexOf('ASTM'), desc.indexOf('ASTM') + 20) : 'Carbon Steel'),
        };
      }
      return {
        ...prev,
        member2: desc,
        dia2: mto.sizeDn,
        nps2: inch,
        thickness2: thk,
        danCode2: mto.danCode,
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-[#0f172a] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Wrench className="h-4 w-4" />
            <span>
              {t.modal.jointTitle} — {form.drawJointNo || stamp.id}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/15 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.typeOfJoint}</label>
              <input
                value={form.typeOfJoint}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 font-mono text-cyan-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.typeOfWeld}</label>
              <select
                value={form.typeOfWelds}
                onChange={(e) => updateField('typeOfWelds', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                {WELD_TYPES.map((w) => (
                  <option key={w} value={w.split(' ')[0]}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t.modal.drawJointNo}</label>
              <input
                value={form.drawJointNo}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 font-mono font-semibold text-amber-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.jointNo}</label>
              <input
                value={form.jointNo}
                onChange={(e) => updateField('jointNo', e.target.value)}
                placeholder="53A"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t.modal.weldingDate}</label>
              <input
                type="date"
                value={form.weldingDate}
                onChange={(e) => updateField('weldingDate', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.editor.welderId}</label>
              <input
                value={form.welderId}
                onChange={(e) => updateField('welderId', e.target.value)}
                placeholder="W-104"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.spool1}</label>
              <input
                value={form.spoolNo1}
                onChange={(e) => updateField('spoolNo1', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.spool2}</label>
              <input
                value={form.spoolNo2}
                onChange={(e) => updateField('spoolNo2', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.pose1}</label>
              <input
                value={form.poseNo1}
                onChange={(e) => updateField('poseNo1', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.pose2}</label>
              <input
                value={form.poseNo2}
                onChange={(e) => updateField('poseNo2', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.member1}</label>
              <select
                value={form.member1}
                onChange={(e) => handleMemberSelect(1, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <option value="">— Select from MTO —</option>
                {mtoItems.map((m) => (
                  <option key={`m1-${m.itemNo}-${m.sheetNo}`} value={m.description}>
                    [{m.itemNo}] {m.description.slice(0, 65)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.member2}</label>
              <select
                value={form.member2}
                onChange={(e) => handleMemberSelect(2, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <option value="">— Select from MTO —</option>
                {mtoItems.map((m) => (
                  <option key={`m2-${m.itemNo}-${m.sheetNo}`} value={m.description}>
                    [{m.itemNo}] {m.description.slice(0, 65)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/70 p-3 rounded-lg border border-slate-800">
            <div className="col-span-2 md:col-span-4">
              <label className="block text-slate-400 mb-1">{t.modal.material}</label>
              <input
                value={form.material}
                onChange={(e) => updateField('material', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.dia1}</label>
              <input
                value={form.dia1}
                onChange={(e) => updateField('dia1', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.dia2}</label>
              <input
                value={form.dia2}
                onChange={(e) => updateField('dia2', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.nps1}</label>
              <input
                value={form.nps1}
                onChange={(e) => updateField('nps1', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.nps2}</label>
              <input
                value={form.nps2}
                onChange={(e) => updateField('nps2', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.thk1}</label>
              <input
                value={form.thickness1}
                onChange={(e) => updateField('thickness1', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t.modal.thk2}</label>
              <input
                value={form.thickness2}
                onChange={(e) => updateField('thickness2', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {t.modal.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(stamp.id, form)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {t.modal.save}
          </button>
        </div>
      </div>
    </div>
  );
};
