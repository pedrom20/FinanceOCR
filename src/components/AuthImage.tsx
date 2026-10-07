import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface AuthImageProps {
  path: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/** <img src> não envia o Bearer token — os endpoints de imagem exigem
 * autenticação como qualquer outro, por isso busca-se via apiFetch e
 * converte-se para um blob URL local em vez de apontar direto para a API. */
export const AuthImage = ({ path, alt, className, style }: AuthImageProps) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    apiFetch(`/api/items/image/${encodeURIComponent(path)}`)
      .then(res => res.blob())
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} style={style} />;
};
