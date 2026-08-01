import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Barcode, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Search, 
  ArrowRight,
  ChevronLeft,
  X,
  Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabaseClient';
import { Inventario, InventarioItem } from '../types';
import { useAuth } from '../context/AuthContext';

interface ContagemInventarioPageProps {
  inventarioId: string;
  onVoltar: () => void;
  onIrReconciliacao: () => void;
}

export const ContagemInventarioPage: React.FC<ContagemInventarioPageProps> = ({
  inventarioId,
  onVoltar,
  onIrReconciliacao,
}) => {
  const { usuarioProfile } = useAuth();

  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [itens, setItens] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Camera Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Audio feedback beep for barcode scan
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz beep
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio fallback silent
    }
  };

  useEffect(() => {
    fetchInventarioDetails();
  }, [inventarioId]);

  const fetchInventarioDetails = async () => {
    setLoading(true);
    try {
      // Fetch inventarios record
      const { data: inv } = await supabase
        .from('inventarios')
        .select('*, filial:filiais(*)')
        .eq('id', inventarioId)
        .single();

      if (inv) setInventario(inv);

      // Fetch inventario_itens with products
      const { data: rawItens } = await supabase
        .from('inventario_itens')
        .select('*, produto:produtos(*)')
        .eq('inventario_id', inventarioId);

      if (rawItens) {
        setItens(rawItens);
      }
    } catch (err) {
      console.error('Erro ao buscar itens do inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start Camera Barcode Scanner
  const startCamera = async () => {
    setScannerError(null);
    setCameraActive(true);

    setTimeout(() => {
      try {
        const scanner = new Html5Qrcode('camera-reader');
        html5QrcodeRef.current = scanner;

        scanner
          .start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            (decodedText) => {
              playBeep();
              handleBarcodeScanned(decodedText);
            },
            (errorMessage) => {
              // ignore frame errors
            }
          )
          .catch((err) => {
            console.error('Erro ao iniciar camera:', err);
            setScannerError('Não foi possível acessar a câmera do dispositivo.');
            setCameraActive(false);
          });
      } catch (err) {
        console.error('Erro no scanner:', err);
      }
    }, 300);
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      } catch (e) {
        // cleanup error
      }
    }
    setCameraActive(false);
  };

  const handleBarcodeScanned = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Find item with matching product code or name
    const targetItem = itens.find(
      (item) =>
        (item.produto?.codigo && item.produto.codigo.toLowerCase() === cleanCode.toLowerCase()) ||
        (item.produto?.nome && item.produto.nome.toLowerCase().includes(cleanCode.toLowerCase()))
    );

    if (targetItem) {
      const novaQtd = (targetItem.quantidade_contada || 0) + 1;
      updateItemCount(targetItem.id, novaQtd);
    } else {
      alert(`Produto com código "${cleanCode}" não encontrado neste inventário.`);
    }
  };

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleBarcodeScanned(barcodeInput.trim());
      setBarcodeInput('');
    }
  };

  // Update item count & call RPC
  const updateItemCount = async (itemId: string, novaQtd: number) => {
    const qtdFinal = Math.max(0, novaQtd);

    // Optimistic UI update
    setItens((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const sys = item.quantidade_sistema || 0;
          const diff = qtdFinal - sys;
          return {
            ...item,
            quantidade_contada: qtdFinal,
            divergencia: diff,
            contado_por: usuarioProfile?.id || null,
            contado_em: new Date().toISOString(),
          };
        }
        return item;
      })
    );

    try {
      // Call RPC registrar_contagem_inventario
      const { error: rpcErr } = await supabase.rpc('registrar_contagem_inventario', {
        p_item_id: itemId,
        p_quantidade_contada: qtdFinal,
        p_usuario_id: usuarioProfile?.id || null,
      });

      if (rpcErr) {
        console.warn('RPC registrar_contagem_inventario fallback update:', rpcErr.message);
        // Fallback direct DB update
        const itemObj = itens.find((i) => i.id === itemId);
        const sys = itemObj ? itemObj.quantidade_sistema || 0 : 0;
        const diff = qtdFinal - sys;
        const recontagem = Math.abs(diff) > 5; // Highlight if diff > 5

        await supabase
          .from('inventario_itens')
          .update({
            quantidade_contada: qtdFinal,
            divergencia: diff,
            recontagem_necessaria: recontagem,
            contado_por: usuarioProfile?.id || null,
            contado_em: new Date().toISOString(),
          })
          .eq('id', itemId);
      }
    } catch (err) {
      console.error('Erro ao registrar contagem:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-3 border-zinc-200 border-t-[#F5D800] rounded-full animate-spin" />
        Carregando lista de contagem do inventário...
      </div>
    );
  }

  if (!inventario) {
    return (
      <div className="p-8 text-center text-zinc-500 space-y-3">
        <p className="text-sm font-semibold text-zinc-800">Inventário não encontrado.</p>
        <button onClick={onVoltar} className="px-4 py-2 bg-zinc-900 text-white text-xs rounded-lg">
          Voltar
        </button>
      </div>
    );
  }

  // Filtered Items
  const filteredItens = itens.filter((i) => {
    const nome = i.produto?.nome || '';
    const cod = i.produto?.codigo || '';
    const loc = i.localizacao_fisica || '';
    const term = search.toLowerCase();
    return nome.toLowerCase().includes(term) || cod.toLowerCase().includes(term) || loc.toLowerCase().includes(term);
  });

  // Separate recount items (recontagem_necessaria = true) to pin at top
  const recountItens = filteredItens.filter((i) => i.recontagem_necessaria === true);
  const normalItens = filteredItens.filter((i) => !i.recontagem_necessaria);

  const contadosCount = itens.filter((i) => i.quantidade_contada !== null && i.quantidade_contada !== undefined).length;
  const progressPct = itens.length > 0 ? Math.round((contadosCount / itens.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="p-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900">
                Contagem de Estoque em Andamento
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                inventario.modo_contagem === 'cega' ? 'bg-zinc-900 text-white' : 'bg-amber-100 text-amber-900'
              }`}>
                Modo {inventario.modo_contagem === 'cega' ? 'Cego' : 'Aberto'}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {inventario.tipo === 'completo' ? 'Inventário Completo' : `Inventário Cíclico (${inventario.localizacao_filtro || 'Geral'})`} • {inventario.filial?.nome || 'Matriz'}
            </p>
          </div>
        </div>

        {/* Progress & Reconciliation Link */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-zinc-900">{contadosCount} / {itens.length} produtos</span>
            <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-[#F5D800] rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={onIrReconciliacao}
            className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <span>Ir para Reconciliação Final</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barcode Scanner Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Quick Manual Barcode Input */}
          <form onSubmit={handleManualBarcodeSubmit} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Escaneie com o leitor ou digite o código do produto..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-mono text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-lg cursor-pointer"
            >
              +1 Somar
            </button>
          </form>

          {/* Camera Scanner Trigger */}
          <button
            type="button"
            onClick={cameraActive ? stopCamera : startCamera}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
              cameraActive
                ? 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                : 'bg-zinc-100 text-zinc-800 border-[#E5E5E5] hover:bg-zinc-200'
            }`}
          >
            <Camera className="w-4 h-4 text-amber-600" />
            <span>{cameraActive ? 'Fechar Câmera' : 'Usar Câmera do Celular/PC'}</span>
          </button>
        </div>

        {/* Camera Viewport Container */}
        {cameraActive && (
          <div className="p-4 bg-zinc-900 rounded-xl text-center space-y-3">
            <div id="camera-reader" className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-zinc-700" />
            {scannerError && <p className="text-xs text-red-400">{scannerError}</p>}
            <p className="text-[11px] text-zinc-400">Aponte a câmera para o código de barras no produto</p>
          </div>
        )}
      </div>

      {/* Search Input for Product List */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar lista por nome de produto, código ou prateleira..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
        />
      </div>

      {/* Recount Highlight Section (recontagem_necessaria = true) */}
      {recountItens.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3 animate-pulse">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>RECONTAGEM NECESSÁRIA ({recountItens.length} itens com alta divergência)</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Estes produtos apresentaram divergência relevante. Exige confirmação de uma segunda pessoa antes de prosseguir.
          </p>

          <div className="divide-y divide-amber-200 bg-white rounded-lg border border-amber-200 overflow-hidden">
            {recountItens.map((item) => (
              <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-bold text-xs text-zinc-900 block">{item.produto?.nome}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold bg-[#F5D800] text-zinc-950 px-1.5 py-0.2 rounded border border-[#d2b800] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.localizacao_fisica || 'Matriz'}
                    </span>
                    <span className="text-[10px] text-zinc-500">Cód: {item.produto?.codigo || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-800 font-semibold">Confirmar 2ª Contagem:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantidade_contada ?? ''}
                    onChange={(e) => updateItemCount(item.id, parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-24 p-1.5 bg-amber-50 border border-amber-400 rounded-lg text-xs font-bold text-center text-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Items List Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
              <tr>
                <th className="p-3.5">Localização Física</th>
                <th className="p-3.5">Produto / SKU</th>
                {inventario.modo_contagem === 'aberta' && (
                  <th className="p-3.5">Qtd Sistema</th>
                )}
                <th className="p-3.5">Quantidade Física Contada</th>
                <th className="p-3.5 text-right">Ação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {normalItens.map((item) => {
                const qtdContada = item.quantidade_contada;
                const foiContado = qtdContada !== null && qtdContada !== undefined;

                return (
                  <tr key={item.id} className={`hover:bg-zinc-50 transition-colors ${foiContado ? 'bg-emerald-50/20' : ''}`}>
                    {/* Localizacao */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-xs bg-[#F5D800] text-zinc-950 px-2 py-0.5 rounded border border-[#d2b800] shadow-2xs">
                        <MapPin className="w-3.5 h-3.5 text-zinc-950" />
                        {item.localizacao_fisica || 'Corredor Geral'}
                      </span>
                    </td>

                    {/* Produto */}
                    <td className="p-3.5">
                      <span className="font-bold text-zinc-900 block text-xs">{item.produto?.nome}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Cód: {item.produto?.codigo || 'Sem código'}
                      </span>
                    </td>

                    {/* Modo Aberto System Stock */}
                    {inventario.modo_contagem === 'aberta' && (
                      <td className="p-3.5 font-bold text-zinc-700">
                        {item.quantidade_sistema} {item.produto?.unidade || 'UN'}
                      </td>
                    )}

                    {/* Qtd Contada Input */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={qtdContada ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            updateItemCount(item.id, val);
                          }}
                          placeholder={inventario.modo_contagem === 'cega' ? 'Digite a qtd vista...' : '0.00'}
                          className={`w-32 p-2 border rounded-lg text-xs font-bold text-center focus:outline-none ${
                            foiContado
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                              : 'bg-zinc-50 border-[#E5E5E5] text-zinc-900'
                          }`}
                        />
                        {foiContado && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </td>

                    {/* Quick +1 / -1 Buttons */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => updateItemCount(item.id, (qtdContada || 0) - 1)}
                          className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-bold cursor-pointer"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItemCount(item.id, (qtdContada || 0) + 1)}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded font-bold cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
