import { useEffect, useState, type ReactNode } from 'react';

// Router minimale basato sull'hash (#/percorso?param=valore):
// funziona ovunque, anche servendo i file statici senza configurazioni.

function read() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to;
}

export function Link({ to, children, className, title }: { to: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <a href={`#${to}`} className={className} title={title}>
      {children}
    </a>
  );
}
