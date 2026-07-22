import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { supabase } from '../supabase';

/*
 * Upload resumável: o arquivo vai DIRETO do navegador para o Google Drive.
 * v2 — aceita qualquer tipo de arquivo (PDF, imagens, vídeos, etc.),
 * envia o origin explicitamente (corrige CORS no PUT ao Google)
 * e mantém erros visíveis na tela até o usuário fechar.
 */
export default function DriveUploader({ item, onDone }) {
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]); // [{name, pct, status, error}]
  const [busy, setBusy] = useState(false);

  function putWithProgress(url, file, onPct) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          onPct(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Resposta inválida do Google.')); }
        } else {
          reject(new Error(`Google recusou o upload (HTTP ${xhr.status}).`));
        }
      };
      xhr.onerror = () =>
        reject(new Error('Falha de rede/CORS ao enviar para o Google.'));
      xhr.send(file);
    });
  }

  async function handleFiles(files) {
    if (!files.length) return;
    setBusy(true);

    for (const file of files) {
      setQueue(previous => [
        ...previous,
        { name: file.name, pct: 0, status: 'enviando', error: false }
      ]);

      const update = patch =>
        setQueue(previous =>
          previous.map(row => (row.name === file.name ? { ...row, ...patch } : row)));

      try {
        const { data: session, error } = await supabase.functions.invoke(
          'drive-manager',
          {
            body: {
              action: 'create_upload_session',
              contentId: item.id,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              origin: window.location.origin  // <- CORS fix
            }
          }
        );
        if (error || !session?.uploadUrl) {
          throw new Error(error?.message || session?.error || 'Sessão de upload falhou.');
        }

        const uploaded = await putWithProgress(
          session.uploadUrl, file, pct => update({ pct })
        );

        const { data: fin, error: finError } = await supabase.functions.invoke(
          'drive-manager',
          {
            body: {
              action: 'finalize_file',
              contentId: item.id,
              fileId: uploaded.id,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size
            }
          }
        );
        if (finError || fin?.error) {
          throw new Error(finError?.message || fin?.error);
        }

        update({ pct: 100, status: 'concluído ✓' });
      } catch (uploadError) {
        update({ status: `erro: ${uploadError.message}`, error: true });
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';

    /* Remove só os concluídos; erros ficam na tela para diagnóstico */
    setTimeout(
      () => setQueue(previous => previous.filter(row => row.error)),
      4000
    );
    if (onDone) await onDone();
  }

  return (
    <div className="drive-uploader">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud size={16} />
        {busy ? 'Enviando ao Drive…' : 'Enviar arquivos ao Drive'}
      </button>

      {/* Sem filtro de tipo: PDF, imagem, vídeo, o que for */}
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={event => handleFiles([...event.target.files])}
      />

      {queue.map(row => (
        <div className="upload-row" key={row.name}>
          <span className="upload-name">{row.name}</span>
          <div className="upload-bar"><i style={{ width: `${row.pct}%` }} /></div>
          <small style={row.error ? { color: '#c0392b' } : undefined}>
            {row.status === 'enviando' ? `${row.pct}%` : row.status}
          </small>
          {row.error && (
            <button
              type="button"
              className="linklike"
              onClick={() =>
                setQueue(previous => previous.filter(r => r.name !== row.name))}
            >
              fechar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
