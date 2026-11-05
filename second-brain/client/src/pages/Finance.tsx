import { useState } from 'react';
import { useFetch, useResource } from '../api';
import { Bars, Card, EntityForm, Empty, Modal, PageHeader, Progress, Stat } from '../components/ui';
import { transactionFields } from '../forms';
import type { Budget, FinanceSummary, Transaction } from '../types';
import { addMonths, EXPENSE_CATEGORIES, fmtDate, fmtMoney, fmtMonth, monthRange, today } from '../utils';

export default function Finance() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { from, to } = monthRange(month);
  const { data: summary } = useFetch<FinanceSummary>(`/finance/summary?month=${month}`);
  const tx = useResource<Transaction>('transactions', { from, to });
  const budgets = useResource<Budget>('budgets');
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null);
  const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const categories = [...new Set(tx.items.map((t) => t.category).filter(Boolean) as string[])];
  const list = tx.items.filter((t) => filter === 'all' || t.type === filter);
  const maxCat = Math.max(1, ...(summary?.byCategory.map((c) => c.total) ?? [1]));

  return (
    <div className="page">
      <PageHeader
        title="Finanze"
        subtitle="Entrate, uscite e budget mensili."
        actions={
          <>
            <button className="btn" onClick={() => setEditing({ type: 'income', date: today(), category: 'Stipendio', account: 'Principale' })}>
              + Entrata
            </button>
            <button className="btn primary" onClick={() => setEditing({ type: 'expense', date: today(), category: 'Spesa', account: 'Principale' })}>
              + Uscita
            </button>
          </>
        }
      />

      <div className="toolbar">
        <div className="nav-group">
          <button className="btn ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente">
            ‹
          </button>
          <strong className="toolbar-title">{fmtMonth(month)}</strong>
          <button className="btn ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo">
            ›
          </button>
        </div>
      </div>

      {summary && (
        <div className="stats-row">
          <Stat label="Entrate" value={fmtMoney(summary.income)} tone="good" />
          <Stat label="Uscite" value={fmtMoney(summary.expense)} tone="bad" />
          <Stat
            label="Risparmio del mese"
            value={fmtMoney(summary.net)}
            sub={summary.income > 0 ? `${Math.round((summary.net / summary.income) * 100)}% delle entrate` : undefined}
            tone={summary.net >= 0 ? 'good' : 'bad'}
          />
          <Stat label="Saldo totale" value={fmtMoney(summary.totalBalance)} tone="accent" />
        </div>
      )}

      <div className="grid">
        <Card title="Spese per categoria">
          {!summary?.byCategory.length ? (
            <Empty>Nessuna spesa registrata.</Empty>
          ) : (
            summary.byCategory.map((c) => <Progress key={c.category} label={c.category} value={c.total} max={maxCat} right={fmtMoney(c.total)} color="var(--red)" />)
          )}
        </Card>

        <Card
          title="Budget mensili"
          action={
            <button className="btn small" onClick={() => setEditingBudget({})}>
              + Budget
            </button>
          }
        >
          {!summary?.budgets.length ? (
            <Empty>Imposta un limite di spesa per le categorie più importanti.</Empty>
          ) : (
            summary.budgets.map((b) => (
              <button key={b.id} className="link block" onClick={() => setEditingBudget(budgets.items.find((x) => x.id === b.id) ?? null)}>
                <Progress
                  label={b.category}
                  value={b.spent}
                  max={b.monthly_limit}
                  right={`${fmtMoney(b.spent)} / ${fmtMoney(b.monthly_limit)}`}
                  color={b.spent > b.monthly_limit * 0.8 ? 'var(--orange)' : 'var(--green)'}
                />
              </button>
            ))
          )}
        </Card>

        <Card title="Ultimi 6 mesi" className="span-all">
          {summary && (
            <>
              <Bars
                data={summary.trend.map((t) => ({ label: fmtMonth(t.month).slice(0, 3), value: t.income, value2: t.expense }))}
                format={(n) => fmtMoney(n)}
                height={160}
              />
              <div className="legend">
                <span className="dot accent" /> Entrate <span className="dot red" /> Uscite
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="section-head">
        <h2>Movimenti</h2>
        <span className="spacer" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtra movimenti">
          <option value="all">Tutti</option>
          <option value="expense">Uscite</option>
          <option value="income">Entrate</option>
        </select>
      </div>
      {list.length === 0 ? (
        <Empty>Nessun movimento in {fmtMonth(month).toLowerCase()}.</Empty>
      ) : (
        <ul className="list card-list">
          {list.map((t) => (
            <li key={t.id} className="row clickable" onClick={() => setEditing(t)}>
              <span className="muted small date-col">{fmtDate(t.date)}</span>
              <span className="grow ellipsis">
                {t.description || t.category}
                {t.account && t.account !== 'Principale' && <span className="muted small"> · {t.account}</span>}
              </span>
              <span className="badge">{t.category}</span>
              <strong className={t.type === 'income' ? 'text-green' : 'text-red'}>
                {t.type === 'income' ? '+' : '−'}
                {fmtMoney(t.amount)}
              </strong>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifica movimento' : editing.type === 'income' ? 'Nuova entrata' : 'Nuova uscita'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={transactionFields(editing.type ?? 'expense', categories)}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => tx.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await tx.update(editing.id, v) : await tx.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
      {editingBudget && (
        <Modal title={editingBudget.id ? 'Modifica budget' : 'Nuovo budget'} onClose={() => setEditingBudget(null)}>
          <EntityForm
            fields={[
              { name: 'category', label: 'Categoria', required: true, suggestions: [...new Set([...EXPENSE_CATEGORIES, ...categories])] },
              { name: 'monthly_limit', label: 'Limite mensile', type: 'number', min: 0, step: 1, required: true },
            ]}
            initial={editingBudget}
            onCancel={() => setEditingBudget(null)}
            onDelete={editingBudget.id ? () => budgets.remove(editingBudget.id!).then(() => setEditingBudget(null)) : undefined}
            onSubmit={async (v) => {
              const r = editingBudget.id ? await budgets.update(editingBudget.id, v) : await budgets.create(v);
              if (r) setEditingBudget(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
