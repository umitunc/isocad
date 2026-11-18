import React, { useState } from 'react';
import { Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { syncOrchestrator } from '../../../integrations/SyncOrchestrator';
import { useLocaleStore } from '../../../i18n/useLocaleStore';
import { useEditorStore } from '../../../store/useEditorStore';

interface EndpointConfigModalProps {
  onExecuteSync: (stage: 'draft' | 'pdf_spool_iso' | 'pdf_as_build') => Promise<void>;
}

export const EndpointConfigModal: React.FC<EndpointConfigModalProps> = ({ onExecuteSync }) => {
  const { t } = useLocaleStore();
  const {
    endpointModalOpen,
    endpointConfig,
    selectedAdapterId,
    syncLogs,
    lastEnvelope,
    setField,
  } = useEditorStore();
  const [stage, setStage] = useState<'draft' | 'pdf_spool_iso' | 'pdf_as_build'>('pdf_as_build');
  const [sending, setSending] = useState(false);

  if (!endpointModalOpen) return null;

  const adapters = syncOrchestrator.getAdapters();

  const handleSend = async () => {
    setSending(true);
    try {
      await onExecuteSync(stage);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-[#0f172a] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
          <h3 className="text-sm font-semibold text-cyan-300">{t.endpoint.title}</h3>
          <button
            type="button"
            onClick={() => setField('endpointModalOpen', false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          <div className="p-5 space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t.endpoint.adapter}</label>
              <select
                value={selectedAdapterId}
                onChange={(e) => setField('selectedAdapterId', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                {adapters.map((a) => (
                  <option key={a.adapterId} value={a.adapterId}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t.endpoint.url}</label>
              <input
                value={endpointConfig.url}
                onChange={(e) =>
                  setField('endpointConfig', { ...endpointConfig, url: e.target.value })
                }
                placeholder="https://api.your-erp.com/v1/weldmap/sync"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">{t.endpoint.method}</label>
                <select
                  value={endpointConfig.method}
                  onChange={(e) =>
                    setField('endpointConfig', {
                      ...endpointConfig,
                      method: e.target.value as 'POST' | 'PUT',
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{t.endpoint.stage}</label>
                <select
                  value={stage}
                  onChange={(e) =>
                    setStage(e.target.value as 'draft' | 'pdf_spool_iso' | 'pdf_as_build')
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                >
                  <option value="pdf_as_build">As-Built PDF (pdf_as_build)</option>
                  <option value="pdf_spool_iso">Spool ISO (pdf_spool_iso)</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t.endpoint.token}</label>
              <input
                value={endpointConfig.token ?? ''}
                onChange={(e) =>
                  setField('endpointConfig', { ...endpointConfig, token: e.target.value })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              />
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={endpointConfig.includeVectorPdf}
                onChange={(e) =>
                  setField('endpointConfig', {
                    ...endpointConfig,
                    includeVectorPdf: e.target.checked,
                  })
                }
                className="rounded border-slate-600"
              />
              <span>{t.endpoint.includePdf}</span>
            </label>

            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Syncing...' : t.endpoint.sendNow}
            </button>
          </div>

          <div className="p-5 flex flex-col gap-3 max-h-[65vh] overflow-y-auto bg-[#090d16]">
            <div className="text-xs font-semibold text-slate-300">{t.endpoint.liveInspector}</div>
            {syncLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                No sync requests dispatched yet. Click &ldquo;{t.endpoint.sendNow}&rdquo; to push
                the live envelope.
              </p>
            ) : (
              syncLogs.slice(0, 3).map((log, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-2.5 text-xs ${
                    log.success
                      ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                      : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      {log.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {log.statusCode} • {log.durationMs}ms
                    </span>
                    <span className="truncate max-w-[200px] text-[10px] opacity-75">
                      {log.endpointUrl}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] opacity-90">{log.message}</div>
                </div>
              ))
            )}
            {lastEnvelope && (
              <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] font-mono text-cyan-200">
                {JSON.stringify(
                  {
                    ...lastEnvelope,
                    artifacts: lastEnvelope.artifacts
                      ? {
                          ...lastEnvelope.artifacts,
                          vectorPdfBase64: lastEnvelope.artifacts.vectorPdfBase64
                            ? `<base64 ${lastEnvelope.artifacts.vectorPdfBase64.length} chars>`
                            : undefined,
                        }
                      : undefined,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
