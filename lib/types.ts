export type Dir = "debit" | "credit";
export type Kind = "upi" | "card" | "neft" | "autodebit" | "refund" | "atm" | "other";
export type CatSource = "rule" | "memory" | "seed" | "llm" | "user";

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  dir: Dir;
  kind: Kind;
  raw: string;
  merchant: string;
  vpa?: string;
  ref?: string;
  bank?: string;
  category: string;
  src: CatSource;
  conf: number;
  review?: boolean;
}

export interface Rule {
  id: string;
  field: "vpa" | "merchant";
  type: "prefix" | "contains" | "equals";
  pattern: string;
  category: string;
  hits: number;
  createdAt: string;
  why?: string;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  date: string;
  weight: number; // share of monthly surplus
}

export interface Profile {
  name: string;
  age: number;
  city: string;
  job: string;
  income: number;
  payDay: number;
  emergencyFund: number;
}

export interface Fact {
  id: string;
  text: string;
  date?: string;
  source: string;
  createdAt: string;
}

export interface TraceStep {
  agent: string;
  action: string;
  detail?: string;
  ms?: number;
}

export interface Trace {
  id: string;
  title: string;
  at: string;
  steps: TraceStep[];
}

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  guardrail?: boolean;
  traceId?: string;
}

export type Voice = "roast" | "hype";

export interface AppState {
  version: number;
  profile: Profile;
  txns: Txn[];
  rules: Rule[];
  goals: Goal[];
  facts: Fact[];
  traces: Trace[];
  chat: ChatMsg[];
  cancelled: string[]; // recurring merchants marked cancelled
  voice: Voice;
  memoryDiff?: { at: string; lines: string[] };
  accuracy: { before: number; after: number };
  review?: { month: string; text: string; traceId?: string };
  letter?: { text: string; mode: string };
}
