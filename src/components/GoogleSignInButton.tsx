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
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
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

  return <div ref={containerRef} className="flex justify-center" />;
};
