import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from '../router';

// ---------- Modal ----------
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- Form generico ----------
export type FieldSpec = {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'checkbox' | 'color';
  options?: (string | { value: string | number; label: string })[];
  required?: boolean;
  placeholder?: string;
  step?: number;
  min?: number;
  rows?: number;
  half?: boolean;
  suggestions?: string[];
};

type Values = Record<string, any>;

export function EntityForm({
  fields,
  initial = {},
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = 'Salva',
  children,
}: {
  fields: FieldSpec[];
  initial?: Values;
  onSubmit: (values: Values) => void | Promise<unknown>;
  onCancel?: () => void;
  onDelete?: () => void;
  submitLabel?: string;
  children?: (values: Values, set: (name: string, v: unknown) => void) => ReactNode;
}) {
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const f of fields) v[f.name] = initial[f.name] ?? (f.type === 'checkbox' ? false : '');
    return { ...initial, ...v };
  });
  const [busy, setBusy] = useState(false);
  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const out: Values = { ...values };
    for (const f of fields) {
      if (f.type === 'number') out[f.name] = out[f.name] === '' || out[f.name] === null ? null : Number(out[f.name]);
      if (f.type === 'select' && typeof f.options?.[0] === 'object' && typeof (f.options[0] as { value: unknown }).value === 'number' && out[f.name] !== '')
        out[f.name] = Number(out[f.name]);
    }
    setBusy(true);
    try {
      await onSubmit(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const common = { id, name: f.name, required: f.required, placeholder: f.placeholder };
          const value = values[f.name] ?? '';
          let input: ReactNode;
          switch (f.type) {
            case 'textarea':
              input = <textarea {...common} rows={f.rows ?? 4} value={value} onChange={(e) => set(f.name, e.target.value)} />;
              break;
            case 'select':
              input = (
                <select {...common} value={value} onChange={(e) => set(f.name, e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => {
                    const opt = typeof o === 'string' ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o;
                    return (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    );
                  })}
                </select>
              );
              break;
            case 'checkbox':
              input = (
                <label className="check">
                  <input type="checkbox" id={id} checked={Boolean(value)} onChange={(e) => set(f.name, e.target.checked)} /> {f.label}
                </label>
              );
              break;
            default:
              input = (
                <>
                  <input
                    {...common}
                    type={f.type === 'datetime' ? 'datetime-local' : (f.type ?? 'text')}
                    step={f.step}
                    min={f.min}
                    value={value}
                    list={f.suggestions ? `${id}-list` : undefined}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                  {f.suggestions && (
                    <datalist id={`${id}-list`}>
                      {f.suggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  )}
                </>
              );
          }
          return (
            <div key={f.name} className={`field ${f.half ? 'half' : ''}`}>
              {f.type !== 'checkbox' && <label htmlFor={id}>{f.label}</label>}
              {input}
            </div>
          );
        })}
      </div>
      {children?.(values, set)}
      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn danger ghost" onClick={onDelete}>
            Elimina
          </button>
        )}
        <span className="spacer" />
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------- blocchi visivi ----------
export function Card({
  title,
  to,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  to?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <h3>{to ? <Link to={to}>{title} →</Link> : title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Progress({ value, max = 100, color, label, right }: { value: number; max?: number; color?: string; label?: ReactNode; right?: ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="progress-wrap">
      {(label || right) && (
        <div className="progress-label">
          <span>{label}</span>
          <span className="muted">{right}</span>
        </div>
      )}
      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-bar ${over ? 'over' : ''}`} style={{ width: `${pct}%`, background: over ? undefined : color }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'accent' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Bars({
  data,
  format = (n) => String(Math.round(n)),
  height = 140,
  target,
}: {
  data: { label: string; value: number; value2?: number }[];
  format?: (n: number) => string;
  height?: number;
  target?: number;
}) {
  const max = Math.max(1, target ?? 0, ...data.flatMap((d) => [d.value, d.value2 ?? 0]));
  return (
    <div className="bars" style={{ height }}>
      {target !== undefined && <div className="bars-target" style={{ bottom: `calc(20px + (100% - 20px) * ${target / max})` }} />}
      {data.map((d) => (
        <div className="bar-col" key={d.label} title={`${d.label}: ${format(d.value)}${d.value2 !== undefined ? ' / ' + format(d.value2) : ''}`}>
          <div className="bar-stack">
            <div className="bar" style={{ height: `${(d.value / max) * 100}%` }} />
            {d.value2 !== undefined && <div className="bar bar2" style={{ height: `${(d.value2 / max) * 100}%` }} />}
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Markdown minimale (titoli, grassetto, corsivo, liste, link, [[collegamenti]]) ----------
function inline(text: string, onWikiLink?: (title: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) {
      const t = m[2];
      out.push(
        <a key={k++} href="#" className="wikilink" onClick={(e) => (e.preventDefault(), onWikiLink?.(t))}>
          {t}
        </a>,
      );
    } else if (m[3]) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[4]) out.push(<em key={k++}>{m[4]}</em>);
    else if (m[5]) out.push(<code key={k++}>{m[5]}</code>);
    else if (m[6])
      out.push(
        <a key={k++} href={m[7]} target="_blank" rel="noreferrer">
          {m[6]}
        </a>,
      );
    else if (m[8])
      out.push(
        <a key={k++} href={m[8]} target="_blank" rel="noreferrer">
          {m[8]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onWikiLink }: { text: string; onWikiLink?: (title: string) => void }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  const flush = () => {
    if (!list) return;
    blocks.push(list.ordered ? <ol key={blocks.length}>{list.items}</ol> : <ul key={blocks.length}>{list.items}</ul>);
    list = null;
  };
  lines.forEach((line, i) => {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(\[( |x)\]\s+)?(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flush();
      const level = Math.min(h[1].length + 2, 6);
      const Tag = `h${level}` as 'h3';
      blocks.push(<Tag key={i}>{inline(h[2], onWikiLink)}</Tag>);
    } else if (ul || ol) {
      const ordered = Boolean(ol && !ul);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      const content = ul ? ul[3] : ol![1];
      const checkbox = ul?.[1] ? <input type="checkbox" readOnly checked={ul[2] === 'x'} /> : null;
      list.items.push(
        <li key={i}>
          {checkbox} {inline(content, onWikiLink)}
        </li>,
      );
    } else if (line.trim() === '') {
      flush();
    } else if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={i} />);
    } else if (line.startsWith('> ')) {
      flush();
      blocks.push(<blockquote key={i}>{inline(line.slice(2), onWikiLink)}</blockquote>);
    } else {
      flush();
      blocks.push(<p key={i}>{inline(line, onWikiLink)}</p>);
    }
  });
  flush();
  return <div className="markdown">{blocks}</div>;
}
