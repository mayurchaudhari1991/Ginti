import { guessCategory } from '@/lib/categorize';
import { getPrefs } from '@/lib/prefs';
import type { Account, Category, TxnKind } from '@/lib/types';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] };

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const { ollamaUrl } = getPrefs();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Round-trip time in ms when the server answers and has the model, otherwise an explanation. */
export async function ping(): Promise<{ ok: true; ms: number } | { ok: false; reason: string }> {
  const { ollamaUrl, ollamaModel, aiEnabled: on } = getPrefs();
  if (!on) return { ok: false, reason: 'Ginti AI is turned off' };
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, { signal: ctrl.signal });
    const data = (await res.json()) as { models?: { name: string }[] };
    if (!data.models?.some((m) => m.name === ollamaModel)) return { ok: false, reason: `Model ${ollamaModel} is not pulled on the PC` };
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, reason: 'PC not reachable on this Wi-Fi' };
  } finally {
    clearTimeout(timer);
  }
}

/** Thrown instead of calling the model when the user has switched Ginti AI off. */
export class AiOffError extends Error {
  constructor() {
    super('Ginti AI is turned off in Settings');
  }
}

export const aiEnabled = () => getPrefs().aiEnabled;

export async function chat(messages: ChatMessage[], opts: { format?: object; timeoutMs?: number } = {}) {
  const { ollamaModel, aiEnabled: on } = getPrefs();
  if (!on) throw new AiOffError();
  const data = await post<{ message: { content: string } }>(
    '/api/chat',
    // No `think` flag: on Ollama 0.20 sending think:false makes Gemma 4 emit stray tool calls instead of an answer.
    { model: ollamaModel, messages, stream: false, format: opts.format, options: { temperature: 0.2 } },
    opts.timeoutMs ?? 60000,
  );
  return cleanReply(data.message.content);
}

/**
 * Older Ollama builds ignore `think: false` for Gemma 4 and prepend its reasoning, ending with a
 * `<channel|>` marker. Keep only what follows the last marker.
 */
function cleanReply(text: string) {
  const marker = text.lastIndexOf('<channel|>');
  return (marker >= 0 ? text.slice(marker + '<channel|>'.length) : text).replace(/<\|?[a-z_]+\|?>/g, '').trim();
}

/** Finds the JSON object in a reply even when the model wraps it in prose or a ``` fence. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  for (const candidate of [fenced, text]) {
    if (!candidate) continue;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        // try the next candidate
      }
    }
  }
  throw new Error('No JSON in model reply');
}

export type ReceiptRead = { merchant: string; total: number; date: string | null; category: string; items: number };

/** Reads a receipt photo (base64 JPEG) with the vision model on the PC. */
export async function readReceipt(base64: string, categories: Category[]): Promise<ReceiptRead> {
  const names = categories.filter((c) => c.kind === 'expense').map((c) => c.name);
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'You read shop and restaurant receipts from India. Return the store name, the final amount paid in rupees ' +
          '(the grand total after tax, not a subtotal), the date as YYYY-MM-DD if printed, the number of line items, ' +
          `and the best category from: ${names.join(', ')}. Reply with JSON only.`,
      },
      { role: 'user', content: 'Read this receipt.', images: [base64] },
    ],
    {
      timeoutMs: 90000,
      format: {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          total: { type: 'number' },
          date: { type: ['string', 'null'] },
          category: { type: 'string', enum: names },
          items: { type: 'integer' },
        },
        required: ['merchant', 'total', 'date', 'category', 'items'],
      },
    },
  );
  return extractJson<ReceiptRead>(content);
}

export type ParsedEntry = {
  amount: number;
  kind: TxnKind;
  categoryId: string | null;
  accountId: string | null;
  note: string;
  occurredAt: string;
  by: 'ai' | 'local';
};

/** Turns "450 swiggy dinner on hdfc card" into a structured entry, using the local model when reachable. */
export async function parseEntry(text: string, categories: Category[], accounts: Account[]): Promise<ParsedEntry> {
  try {
    return await parseWithModel(text, categories, accounts);
  } catch {
    return parseLocally(text, categories, accounts);
  }
}

export async function parseWithModel(text: string, categories: Category[], accounts: Account[]): Promise<ParsedEntry> {
  const expenseCats = categories.filter((c) => c.kind === 'expense').map((c) => c.name);
  const incomeCats = categories.filter((c) => c.kind === 'income').map((c) => c.name);
  const accountNames = accounts.map((a) => a.name);
  const now = new Date();
  const schema = {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      kind: { type: 'string', enum: ['expense', 'income'] },
      category: { type: 'string', enum: [...expenseCats, ...incomeCats] },
      account: { type: 'string', enum: accountNames },
      note: { type: 'string' },
      days_ago: { type: 'integer' },
    },
    required: ['amount', 'kind', 'category', 'account', 'note', 'days_ago'],
  };
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'You turn a short Indian personal-finance note into one ledger entry. Amounts are rupees. ' +
          `Expense categories: ${expenseCats.join(', ')}. Income categories: ${incomeCats.join(', ')}. ` +
          `Accounts: ${accountNames.join(', ')}. If no account is named, choose the cash account for small amounts. ` +
          'note is a short title-cased description without the amount or account. days_ago is 0 unless the text says yesterday or a date. ' +
          `Today is ${now.toDateString()}. Reply with JSON only.`,
      },
      { role: 'user', content: text },
    ],
    // A cold model takes ~50 s to load on this PC; warm replies take ~15 s.
    { format: schema, timeoutMs: 45000 },
  );
  const out = extractJson<{ amount: number; kind: string; category: string; account: string; note: string; days_ago: number }>(content);
  if (!(out.amount > 0)) throw new Error('No amount');
  const kind: TxnKind = out.kind?.toLowerCase() === 'income' ? 'income' : 'expense';
  const when = new Date();
  when.setDate(when.getDate() - Math.max(0, out.days_ago || 0));
  return {
    amount: out.amount,
    kind,
    categoryId: categories.find((c) => c.name.toLowerCase() === out.category?.toLowerCase() && c.kind === kind)?.id ?? null,
    accountId: accounts.find((a) => a.name.toLowerCase() === out.account?.toLowerCase())?.id ?? null,
    note: out.note,
    occurredAt: when.toISOString(),
    by: 'ai',
  };
}

/** Keyword fallback so adding an entry still works when the PC is off. */
export function parseLocally(text: string, categories: Category[], accounts: Account[]): ParsedEntry {
  const lower = text.toLowerCase();
  const amount = Number(lower.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const isIncome = /\b(salary|received|got|income|refund|credited)\b/.test(lower);
  const kind: TxnKind = isIncome ? 'income' : 'expense';
  const account =
    accounts.find((a) => lower.includes(a.name.toLowerCase().split(' ')[0])) ??
    (/\bcash\b/.test(lower) ? accounts.find((a) => a.kind === 'cash') : undefined) ??
    accounts.find((a) => a.kind === 'cash') ??
    accounts[0];
  const note = text
    .replace(/(\d+(?:[.,]\d+)?)/g, '')
    .replace(/\b(on|via|from|by|using|paid|rs|inr|₹|card|upi)\b/gi, '')
    .replace(account ? new RegExp(account.name.split(' ')[0], 'i') : /$^/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const when = new Date();
  if (/\byesterday\b/.test(lower)) when.setDate(when.getDate() - 1);
  return {
    amount,
    kind,
    categoryId: guessCategory(text, kind, categories),
    accountId: account?.id ?? null,
    note: note ? note[0].toUpperCase() + note.slice(1) : '',
    occurredAt: when.toISOString(),
    by: 'local',
  };
}

/** Answers a question about the user's money from a precomputed ledger digest. */
export async function askLedger(question: string, digest: string, history: ChatMessage[]) {
  return chat([
    {
      role: 'system',
      content:
        "You are Ginti AI, a concise personal-finance assistant inside the user's expense tracker. " +
        'Answer only from the ledger data below; if the data cannot answer, say so. Use ₹ with Indian digit grouping. ' +
        'Keep answers under 80 words, lead with the number, and offer one practical tip when relevant.\n\nLEDGER DATA:\n' +
        digest,
    },
    ...history.slice(-6),
    { role: 'user', content: question },
  ]);
}
