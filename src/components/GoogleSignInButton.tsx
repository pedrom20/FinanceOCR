import React, { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Botão "Sign in with Google" (Google Identity Services). Não renderiza nada se VITE_GOOGLE_CLIENT_ID não estiver definido. */
export const GoogleSignInButton = ({ onCredential }: { onCredential: (credential: string) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const render = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: response => onCredential(response.credential),
      });
      // width tem de ser um número de pixels fixo (a API não aceita "100%") —
      // mede o contentor em vez de usar um valor fixo, para não estourar em ecrãs
      // estreitos (ex: dentro do cartão de login em telemóveis pequenos).
      const width = Math.min(320, containerRef.current.clientWidth || 320);
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width,
      });
    };

    if (window.google) {
      render();
      return;
    }
    const script = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]');
    script?.addEventListener('load', render, { once: true });
  }, [onCredential]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className="d-flex justify-content-center" />;
};
