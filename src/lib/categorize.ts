import type { Category, TxnKind } from '@/lib/types';

const KEYWORDS: Record<string, string[]> = {
  Food: ['swiggy', 'zomato', 'food', 'dinner', 'lunch', 'breakfast', 'tea', 'chai', 'coffee', 'snack', 'grocer', 'restaurant', 'cafe', 'pizza', 'blinkit', 'zepto', 'bigbasket', 'dmart', 'mart'],
  Travel: ['uber', 'ola', 'auto', 'metro', 'bus', 'train', 'irctc', 'cab', 'petrol', 'fuel', 'rapido', 'flight', 'fastag'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'shirt', 'shoes', 'shopping', 'clothes'],
  Bills: ['bill', 'electricity', 'recharge', 'wifi', 'broadband', 'jio', 'airtel', 'gas', 'water', 'emi', 'insurance'],
  Health: ['medicine', 'doctor', 'pharmacy', 'apollo', 'gym', 'hospital', 'clinic'],
  Fun: ['movie', 'netflix', 'spotify', 'hotstar', 'bookmyshow', 'game', 'party', 'concert'],
  Home: ['rent', 'maid', 'furniture', 'repair', 'urban company'],
  Salary: ['salary', 'stipend', 'payroll'],
};

// Whole-word prefixes: "grocer" matches "groceries", but "ola" never matches "cola" and "emi" never matches "premium".
const PATTERNS = Object.entries(KEYWORDS).map(([cat, words]) => [cat, new RegExp(`\\b(?:${words.join('|')})`, 'i')] as const);

/** Best keyword match for a description, falling back to Other / Other income. */
export function guessCategory(text: string, kind: TxnKind, categories: Category[]) {
  const name = PATTERNS.find(([, re]) => re.test(text))?.[0] ?? (kind === 'income' ? 'Other income' : 'Other');
  return (
    categories.find((c) => c.name === name && c.kind === kind)?.id ??
    categories.find((c) => c.name === (kind === 'income' ? 'Other income' : 'Other') && c.kind === kind)?.id ??
    null
  );
}
