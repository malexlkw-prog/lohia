import React, { useRef, useState } from 'react';
import { LoreEntity } from '../types/lore';
import { Settings, Download, Upload, Trash2, Check, Sparkles, Database } from 'lucide-react';

interface SettingsViewProps {
  entities: LoreEntity[];
  onImportMemory: (entities: LoreEntity[]) => void;
  onClearMemory: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  entities,
  onImportMemory,
  onClearMemory,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entities, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `loh_ai_memoria_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setSuccessMsg('Memória da LOH exportada com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportMemory(parsed);
          setSuccessMsg(`Memória importada com sucesso (${parsed.length} itens)!`);
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          alert('Arquivo JSON inválido. Formato incompatível com a memória da LOH.');
        }
      } catch (err) {
        console.error('Erro ao ler arquivo JSON:', err);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleExecuteClear = () => {
    onClearMemory();
    setConfirmClear(false);
    setSuccessMsg('Toda a memória foi limpa com sucesso do banco de dados.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-800/80">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-blue-500" />
          Configurações
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Ajustes essenciais e gerenciamento dos registros da League Ofter High.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Core AI Identifiers */}
      <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Identidade e Motor
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">Nome da Inteligência</span>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium">
              LOH AI (Oficial)
            </div>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">Modelo de Raciocínio</span>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium">
              Google Gemini (Auto-Fallback / GEMINI_MODEL)
            </div>
          </div>
        </div>
        <div className="pt-2 text-[11px] text-zinc-400">
          Criada especificamente para o universo <strong className="text-zinc-300">League Ofter High (LOH)</strong> de Marcos. Modos de operação: <span className="text-blue-400 font-medium">Conhecimento</span> (explicações canônicas), <span className="text-purple-400 font-medium">Assistente</span> (continuidade e lutas) e <span className="text-amber-400 font-medium">Produtor</span> (desenvolvimento de filmes, séries e projetos audiovisuais).
        </div>
      </div>

      {/* Memory Management */}
      <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          Gerenciamento da Memória ({entities.length} registros)
        </h2>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <div>
              <div className="text-sm font-medium text-white">Exportar Cânone</div>
              <div className="text-xs text-zinc-400">
                Baixe um arquivo JSON contendo todos os personagens, eventos, poderes e relações.
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={entities.length === 0}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                entities.length > 0
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer'
                  : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Exportar JSON</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <div>
              <div className="text-sm font-medium text-white">Importar Memória</div>
              <div className="text-xs text-zinc-400">
                Carregue um arquivo JSON para atualizar a base da LOH.
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importar JSON</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <div>
              <div className="text-sm font-medium text-white">Limpar Toda a Memória</div>
              <div className="text-xs text-zinc-400">
                Apaga permanentemente todos os registros da memória no banco de dados.
              </div>
            </div>

            {confirmClear ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-red-300 font-medium">Tem certeza?</span>
                <button
                  type="button"
                  onClick={handleExecuteClear}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Sim, Limpar Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={entities.length === 0}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  entities.length > 0
                    ? 'bg-zinc-800 hover:bg-red-950/40 hover:text-red-300 text-zinc-300 cursor-pointer'
                    : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar Banco</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
