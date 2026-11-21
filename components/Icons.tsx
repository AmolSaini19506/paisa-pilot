"use client";
import {
  Home, ShoppingBasket, Bike, UtensilsCrossed, Coffee, Car, ShoppingBag, Lightbulb, Tv, Smartphone, TrendingUp,
  HeartPulse, TrainFront, Users, Wallet, Undo2, CircleHelp, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Rent: Home, Groceries: ShoppingBasket, "Food delivery": Bike, "Dining out": UtensilsCrossed, "Snacks/Chai": Coffee,
  Transport: Car, Shopping: ShoppingBag, "Bills & utilities": Lightbulb, Subscriptions: Tv, EMI: Smartphone,
  "SIP/Investments": TrendingUp, Health: HeartPulse, Travel: TrainFront, "Family transfers": Users, Salary: Wallet,
  Refund: Undo2, Other: CircleHelp,
};

export function CatIcon({ c, size = 15 }: { c: string; size?: number }) {
  const I = MAP[c] ?? CircleHelp;
  return <I size={size} strokeWidth={1.75} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--muted)", flexShrink: 0 }} aria-hidden />;
}

export function Ico({ i: I, size = 16 }: { i: LucideIcon; size?: number }) {
  return <I size={size} strokeWidth={1.75} style={{ verticalAlign: "-3px", flexShrink: 0 }} aria-hidden />;
}

import { ShieldCheck, Palmtree, Laptop, Flag } from "lucide-react";
const GOALS: Record<string, LucideIcon> = { g1: ShieldCheck, g2: Palmtree, g3: Laptop };
export function GoalIcon({ id, size = 16 }: { id: string; size?: number }) {
  const I = GOALS[id] ?? Flag;
  return <I size={size} strokeWidth={1.75} style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--muted)", flexShrink: 0 }} aria-hidden />;
}
