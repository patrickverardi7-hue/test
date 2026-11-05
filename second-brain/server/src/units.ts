// Unità di misura e reparti del supermercato per la spesa.
// Le quantità vengono salvate sempre in unità base: g, ml, pz.

// ---------- unità di misura ----------
const UNIT_MAP: Record<string, [string, number]> = {
  g: ['g', 1], gr: ['g', 1], grammi: ['g', 1], grammo: ['g', 1],
  kg: ['g', 1000], chili: ['g', 1000], chilo: ['g', 1000],
  ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000], lt: ['ml', 1000], litro: ['ml', 1000], litri: ['ml', 1000],
  pz: ['pz', 1], pezzo: ['pz', 1], pezzi: ['pz', 1], '': ['pz', 1], n: ['pz', 1],
};

export function normalize(quantity: number | null | undefined, unit: string | null | undefined): { quantity: number; unit: string } {
  const u = (unit ?? '').trim().toLowerCase().replace(/\.$/, '');
  const [base, factor] = UNIT_MAP[u] ?? [u, 1];
  return { quantity: (Number(quantity) || 0) * factor, unit: base };
}

export const keyOf = (name: string, unit: string) => `${name.trim().toLowerCase()}|${unit}`;

// ---------- reparti del supermercato (indovinati dal nome) ----------
const CATEGORY_WORDS: [string, string[]][] = [
  ['Frutta e verdura', ['mela', 'mele', 'banan', 'pera', 'arancia', 'aranc', 'limon', 'frutti', 'mirtill', 'fragol', 'kiwi', 'uva', 'insalat', 'lattuga', 'rucola', 'spinac', 'pomodor', 'zucchin', 'carot', 'cipoll', 'aglio', 'patat', 'peperon', 'melanzan', 'broccol', 'cavol', 'funghi', 'avocado', 'verdur', 'frutta', 'basilico', 'prezzemolo']],
  ['Carne e pesce', ['pollo', 'tacchino', 'manzo', 'vitello', 'maiale', 'carne', 'bresaola', 'prosciutto', 'salmone', 'tonno', 'merluzzo', 'pesce', 'gamber', 'orata', 'branzino', 'hamburger', 'macinato', 'uova', 'uovo']],
  ['Latticini', ['latte', 'yogurt', 'formagg', 'mozzarell', 'parmigian', 'grana', 'ricotta', 'burro', 'skyr', 'kefir', 'fiocchi di latte', 'panna']],
  ['Pane e cereali', ['pane', 'pasta', 'riso', 'avena', 'farro', 'orzo', 'quinoa', 'cereali', 'fette biscottate', 'gallette', 'farina', 'piadina', 'cracker', 'couscous']],
  ['Dispensa', ['olio', 'aceto', 'sale', 'zucchero', 'miele', 'legumi', 'ceci', 'lenticch', 'fagioli', 'passata', 'sugo', 'spezie', 'caffè', 'tè', 'cioccolat', 'frutta secca', 'mandorl', 'noci', 'burro di arachidi', 'marmellata', 'biscotti']],
  ['Surgelati', ['surgelat', 'gelato', 'piselli']],
  ['Bevande', ['acqua', 'succo', 'birra', 'vino', 'bibita']],
  ['Casa e igiene', ['detersivo', 'carta', 'sapone', 'shampoo', 'dentifricio', 'sacchetti', 'spugn']],
  ['Integratori', ['proteine in polvere', 'whey', 'creatina', 'integrator', 'vitamin']],
];

export function guessCategory(name: string): string {
  const n = name.toLowerCase();
  for (const [cat, words] of CATEGORY_WORDS) if (words.some((w) => n.includes(w))) return cat;
  return 'Altro';
}


/** Normalizza quantità/soglia prima del salvataggio (hook di pantry_items e shopping_items) */
export function normalizeRecord(data: Record<string, unknown>, existing?: Record<string, unknown>) {
  if (data.unit === undefined && data.quantity === undefined && data.min_quantity === undefined) {
    if (!existing && data.name && !data.category) data.category = guessCategory(String(data.name));
    return;
  }
  const unit = (data.unit ?? existing?.unit ?? 'pz') as string;
  const base = normalize(1, unit);
  if (data.quantity !== undefined && data.quantity !== null && data.quantity !== '') data.quantity = normalize(Number(data.quantity), unit).quantity;
  if (data.min_quantity !== undefined && data.min_quantity !== null && data.min_quantity !== '') data.min_quantity = normalize(Number(data.min_quantity), unit).quantity;
  data.unit = base.unit;
  const name = (data.name ?? existing?.name) as string | undefined;
  if (!existing && name && !data.category) data.category = guessCategory(name);
}
