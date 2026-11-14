import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import { canvasToBlob, renderShareCard, ShareCardData } from '../../utils/shareCard';
import { useToast } from '../ui/Toast';

interface ShareCardModalProps {
  data: ShareCardData;
  onClose: () => void;
}

const FILE_NAME = 'racha-resumo.png';

export const ShareCardModal: React.FC<ShareCardModalProps> = ({ data, onClose }) => {
  const toast = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    const generate = async () => {
      const canvas = renderShareCard(data);
      const result = await canvasToBlob(canvas);
      if (cancelled) return;
      if (!result) {
        setFailed(true);
        return;
      }
      url = URL.createObjectURL(result);
      setBlob(result);
      setPreviewUrl(url);
    };
    void generate();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show('Imagem baixada!');
  };

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Resumo do Racha' });
        return;
      }
      handleDownload();
    } catch {
      // usuário cancelou o compartilhamento
    }
  };

  const canNativeShare = typeof navigator.share === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-md animate-sheet-in flex-col gap-3 rounded-3xl border border-white/10 bg-[#151d16] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">Card do Racha</h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-950">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Prévia do card com o pódio do racha"
              className="max-h-[56vh] w-auto max-w-full object-contain"
            />
          ) : failed ? (
            <p className="p-8 text-sm text-red-400">Não foi possível gerar a imagem.</p>
          ) : (
            <div className="flex items-center gap-2 p-10 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando imagem...
            </div>
          )}
        </div>

        <div className={`grid gap-2 ${canNativeShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            onClick={handleDownload}
            disabled={!blob}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-extrabold text-zinc-950 active:scale-95 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Baixar PNG
          </button>
          {canNativeShare && (
            <button
              onClick={handleShare}
              disabled={!blob}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
