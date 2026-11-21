import { categorize } from "./categorize";
import type { AppState, Goal, Kind, Profile, Txn } from "./types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const PROFILE: Profile = {
  name: "Riya",
  age: 27,
  city: "Bengaluru",
  job: "Product analyst",
  income: 115000,
  payDay: 1,
  emergencyFund: 110000,
};

export const GOALS: Goal[] = [
  { id: "g1", name: "Emergency fund (6 months)", emoji: "🛟", target: 300000, saved: 110000, date: "2027-06-30", weight: 0.5 },
  { id: "g2", name: "Goa trip with the gang", emoji: "🏖️", target: 45000, saved: 12000, date: "2027-03-15", weight: 0.3 },
  { id: "g3", name: "New laptop", emoji: "💻", target: 90000, saved: 10000, date: "2027-12-31", weight: 0.2 },
];

const pad = (n: number) => String(n).padStart(2, "0");
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

let idc = 0;
function mk(
  date: string, amount: number, dir: "debit" | "credit", kind: Kind, merchant: string, raw: string, vpa?: string, bank = "HDFC",
): Txn {
  idc++;
  return {
    id: "s" + idc, date, amount, dir, kind, merchant, raw, vpa, bank,
    ref: String(400000000000 + idc * 7919), category: "Other", src: "seed", conf: 0.2,
  };
}

function smsFor(d: string, amt: number, who: string, vpa?: string, kind: Kind = "upi") {
  const [y, m, day] = d.split("-");
  const dd = `${day}-${MON[+m - 1]}-${y.slice(2)}`;
  const a = amt.toLocaleString("en-IN");
  if (kind === "upi") return `Rs.${a} debited from HDFC Bank A/c **4821 on ${dd} to VPA ${vpa} (UPI Ref No 4${day}${m}88231). Not you? Call 18002586161`;
  if (kind === "card") return `Rs.${a} spent on HDFC Bank Card x9921 at ${who.toUpperCase()} on ${dd}. Avl Lmt Rs.1,12,400`;
  if (kind === "autodebit") return `Rs.${a} auto-debited from A/c **4821 towards ${who.toUpperCase()} via NACH on ${dd}.`;
  return `INR ${a} debited from A/c XX4821 on ${dd} Info: ${who}`;
}

export function generateSeed(): Txn[] {
  idc = 0;
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: Txn[] = [];
  const months: [number, number, number][] = [[2026, 8, 31], [2026, 9, 30], [2026, 10, 31], [2026, 11, 20]];

  for (const [y, m, last] of months) {
    const D = (d: number) => `${y}-${pad(m)}-${pad(Math.min(d, last))}`;
    const full = last >= 28;
    const isNov = m === 11;

    out.push(mk(D(1), PROFILE.income, "credit", "neft", "Salary Zentrix Labs",
      `Rs.1,15,000.00 credited to A/c XX4821 on ${pad(1)}-${MON[m - 1]}-26 by NEFT/SALARY ZENTRIX LABS PVT LTD. Avl bal Rs.1,38,220`));
    out.push(mk(D(3), 26000, "debit", "upi", "Landlord Rent", smsFor(D(3), 26000, "", "rentkumar.s@okicici"), "rentkumar.s@okicici"));
    out.push(mk(D(5), 5000, "debit", "autodebit", "SIP Nippon NACH", smsFor(D(5), 5000, "BSE STAR MF SIP", undefined, "autodebit")));
    out.push(mk(D(7), 3200, "debit", "autodebit", "Bajaj Fin EMI", smsFor(D(7), 3200, "BAJAJ FIN EMI", undefined, "autodebit")));
    out.push(mk(D(9), 599, "debit", "upi", "Airtel", smsFor(D(9), 599, "", "airtelpayments@airtel"), "airtelpayments@airtel"));
    out.push(mk(D(12), 1300 + Math.round(r() * 300), "debit", "upi", "BESCOM", smsFor(D(12), 1400, "", "bescom@ybl"), "bescom@ybl"));
    out.push(mk(D(10), 8000, "debit", "upi", "Mom", smsFor(D(10), 8000, "", "sunita.sharma@oksbi"), "sunita.sharma@oksbi"));

    // Subscriptions
    const nf = isNov ? 649 : 499;
    out.push(mk(D(14), nf, "debit", "card", "Netflix", smsFor(D(14), nf, "NETFLIX.COM", undefined, "card")));
    out.push(mk(D(18), 119, "debit", "autodebit", "Spotify", smsFor(D(18), 119, "SPOTIFY INDIA", undefined, "autodebit")));
    out.push(mk(D(20), 299, "debit", "card", "Hotstar", smsFor(D(20), 299, "DISNEY HOTSTAR", undefined, "card")));
    if (!isNov || last >= 2) out.push(mk(D(2), 149, "debit", "autodebit", "YouTube Premium", smsFor(D(2), 149, "GOOGLE YOUTUBE", undefined, "autodebit")));
    out.push(mk(D(6), 1499, "debit", "autodebit", "Cult.fit", smsFor(D(6), 1499, "CULTFIT ELITE", undefined, "autodebit")));

    // Food delivery — Nov runs hot
    const fd = isNov ? 14 : 12 + Math.floor(r() * 3);
    for (let i = 0; i < fd; i++) {
      const d = 1 + Math.floor(r() * last);
      const brand = pick(["swiggy", "zomato", "swiggy", "zomato", "swiggy"]);
      const amt = Math.round(220 + r() * (isNov ? 420 : 300));
      const vpa = brand === "swiggy" ? "swiggy.stores@icici" : "zomato.order@hdfcbank";
      out.push(mk(D(d), amt, "debit", "upi", brand === "swiggy" ? "Swiggy" : "Zomato", smsFor(D(d), amt, "", vpa), vpa));
    }
    // Groceries quick commerce
    for (let i = 0; i < (full ? 10 : 7); i++) {
      const d = 1 + Math.floor(r() * last);
      const b = pick(["zepto", "blinkit", "bigbasket", "zepto"]);
      const vpa = { zepto: "zepto.payu@axisbank", blinkit: "blinkit.grofers@hdfcbank", bigbasket: "bigbasket@ybl" }[b]!;
      const amt = Math.round(b === "bigbasket" ? 1200 + r() * 900 : 160 + r() * 420);
      out.push(mk(D(d), amt, "debit", "upi", b[0].toUpperCase() + b.slice(1), smsFor(D(d), amt, "", vpa), vpa));
    }
    // Chai / snacks street vendors — the leak. Unknown to seed map.
    const vendors = ["bharatpe.9071834512@icici", "bharatpe.8105523390@icici", "paytmqr281005050101@paytm", "paytmqr6sx9kd@paytm", "q901234567@ybl"];
    for (let i = 0; i < (full ? 26 : 19); i++) {
      const d = 1 + Math.floor(r() * last);
      const vpa = pick(vendors);
      const amt = pick([20, 30, 40, 50, 60, 80, 90, 120, 150]);
      out.push(mk(D(d), amt, "debit", "upi", vpa, smsFor(D(d), amt, "", vpa), vpa));
    }
    // Transport
    for (let i = 0; i < (full ? 14 : 10); i++) {
      const d = 1 + Math.floor(r() * last);
      const b = pick(["rapido", "uber", "rapido"]);
      const vpa = b === "rapido" ? "rapido.bike@axisbank" : "uber.india@hdfcbank";
      const amt = Math.round(b === "rapido" ? 60 + r() * 120 : 180 + r() * 320);
      out.push(mk(D(d), amt, "debit", "upi", b === "rapido" ? "Rapido" : "Uber", smsFor(D(d), amt, "", vpa), vpa));
    }
    // Dining out
    for (let i = 0; i < (full ? 4 : 3); i++) {
      const d = 1 + Math.floor(r() * last);
      const place = pick(["Toit Brewpub", "Third Wave Coffee", "Truffles", "Social Indiranagar"]);
      const amt = Math.round(450 + r() * 1300);
      out.push(mk(D(d), amt, "debit", "card", place, smsFor(D(d), amt, place, undefined, "card")));
    }
    // Shopping
    for (let i = 0; i < (full ? 4 : 3); i++) {
      const d = 1 + Math.floor(r() * last);
      const b = pick(["Amazon", "Myntra", "Amazon"]);
      const amt = Math.round(499 + r() * 2600);
      out.push(mk(D(d), amt, "debit", "card", b, smsFor(D(d), amt, b === "Amazon" ? "AMAZON PAY INDIA" : "MYNTRA DESIGNS", undefined, "card")));
    }
    // Health, travel
    if (r() > 0.3) {
      const d = 1 + Math.floor(r() * last);
      const amt = Math.round(300 + r() * 900);
      out.push(mk(D(d), amt, "debit", "upi", "Apollo Pharmacy", smsFor(D(d), amt, "", "apollopharmacy@ybl"), "apollopharmacy@ybl"));
    }
    if (m === 10) out.push(mk(D(19), 2840, "debit", "card", "IRCTC", smsFor(D(19), 2840, "IRCTC E-TICKETING", undefined, "card")));
    if (m === 8) out.push(mk(D(15), 1850, "debit", "card", "IRCTC", smsFor(D(15), 1850, "IRCTC E-TICKETING", undefined, "card")));
    // a split-the-bill credit back from a friend
    if (m === 9) out.push(mk(D(22), 650, "credit", "upi", "Aarav", `You have received Rs.650 from aarav.m@okaxis on 22-SEP-26. UPI Ref 6271990012`, "aarav.m@okaxis"));
  }

  const mem = new Map<string, string>();
  for (const t of out) {
    const c = categorize(t, [], mem);
    t.category = c.category; t.src = c.src; t.conf = c.conf;
    if (/^Landlord/.test(t.merchant)) { t.category = "Rent"; t.src = "user"; t.conf = 1; }
    if (t.merchant === "Mom") { t.category = "Family transfers"; t.src = "user"; t.conf = 1; }
    if (t.category === "Other") t.review = true;
    // pretty names for vendor VPAs
    if (t.merchant.includes("@")) {
      const h = t.merchant.split("@")[0];
      t.merchant = /^bharatpe/.test(h) ? `BharatPe ${h.slice(-4)}` : /^paytmqr/.test(h) ? `Paytm QR ${h.slice(-4)}` : `UPI ${h.slice(-4)}`;
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function initialState(): AppState {
  // categorised above from the SMS text; the text itself is never kept
  const txns = generateSeed().map((t) => ({ ...t, raw: "" }));
  return {
    version: 3,
    profile: PROFILE,
    txns,
    rules: [],
    goals: GOALS,
    facts: [
      { id: "f1", text: "Landlord said rent goes up 8% from 1 Mar 2027", date: "2027-03-01", source: "coach chat", createdAt: "2026-11-02" },
      { id: "f2", text: "Diwali in Nov + cousin's wedding in Dec usually mean ~₹25k extra spend", date: "2026-12-10", source: "coach chat", createdAt: "2026-11-05" },
    ],
    traces: [],
    chat: [],
    cancelled: [],
    voice: "roast",
    accuracy: { before: 0, after: 0 },
  };
}

/** The fresh messy batch for the live import demo. */
export const SAMPLE_SMS = `Rs.180.00 debited from HDFC Bank A/c **4821 on 21-NOV-26 to VPA bharatpe.9071834512@icici (UPI Ref No 633012998812). Not you? Call 18002586161

Your OTP for txn of Rs.2,499 at MYNTRA is 448120. Do not share it with anyone. -ICICI Bank

Dear Customer, INR 649.00 spent on ICICI Bank Credit Card XX3301 on 21-Nov-26 at NETFLIX.COM. Avl Limit: INR 1,84,200.

A/c XX4821 debited by Rs 312 on 20/11/2026 trf to zomato.order@hdfcbank UPI Ref 633019021145 -SBI

Rs.1,00,000 credited to your A/c XXX7712 on 20-11-26 by NEFT from RIYA SHARMA-SELF. Avl Bal Rs.2,10,000 -Axis Bank

₹45 paid to paytmqr281005050101@paytm from A/c **4821 on 21-NOV-26. UPI Ref 633044117263

Rs.1499.00 auto-debited from A/c **4821 towards CULTFIT ELITE via NACH on 21-NOV-26.

Rs.249 debited from A/c XX4821 on 20-NOV-26 to VPA chaipoint.blr@ybl UPI Ref 633051220981

Rs.312 debited from HDFC Bank A/c **4821 on 20-NOV-26 to VPA zomato.order@hdfcbank (UPI Ref No 633019021145).

Get flat 20% cashback upto Rs.150 on your next recharge! Click here to apply now.

Rs.86.00 debited from A/c **4821 on 19-NOV-26 to VPA rapido.bike@axisbank UPI Ref 633060011872

Rs 2,150 spent on HDFC Bank Card x9921 at DECATHLON SPORTS on 19-Nov-26.

Rs.380 sent to aarav.m@okaxis from A/c **4821 on 18-NOV-26 for dinner split. UPI Ref 633070034451

Rs.60 debited from A/c **4821 on 21-NOV-26 to VPA q901234567@ybl UPI Ref 633081210099

Rs.799 debited via UPI to VPA lenskart.payu@hdfcbank on 18-NOV-26 Ref 633090001231 -Kotak Bank`;

export const SAMPLE_CSV = `Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance
17/11/26,UPI-BIGBASKET-bigbasket@ybl-Groceries,1645.00,,92010.20
16/11/26,UPI-THIRDWAVE-thirdwave.coffee@icici-Coffee,420.00,,93655.20
16/11/26,UPI-BHARATPE-bharatpe.8105523390@icici-Payment,70.00,,94075.20
15/11/26,NEFT CR-REFUND AMAZON,,899.00,94145.20
15/11/26,UPI-PVR-pvrcinemas@hdfcbank-Movie,780.00,,93246.20`;
