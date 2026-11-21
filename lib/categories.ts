export const CATEGORIES: { name: string; emoji: string; color: string }[] = [
  { name: "Rent", emoji: "🏠", color: "#7B5CFF" },
  { name: "Groceries", emoji: "🥦", color: "#3DDC84" },
  { name: "Food delivery", emoji: "🛵", color: "#FF5C39" },
  { name: "Dining out", emoji: "🍝", color: "#FF8A3D" },
  { name: "Snacks/Chai", emoji: "☕", color: "#C98A4B" },
  { name: "Transport", emoji: "🛺", color: "#22B8F0" },
  { name: "Shopping", emoji: "🛍️", color: "#FF4FD8" },
  { name: "Bills & utilities", emoji: "💡", color: "#F5C400" },
  { name: "Subscriptions", emoji: "📺", color: "#E8336D" },
  { name: "EMI", emoji: "📱", color: "#5B6CFF" },
  { name: "SIP/Investments", emoji: "📈", color: "#00A884" },
  { name: "Health", emoji: "💊", color: "#2EC4B6" },
  { name: "Travel", emoji: "🚆", color: "#4D96FF" },
  { name: "Family transfers", emoji: "👨‍👩‍👧", color: "#B983FF" },
  { name: "Salary", emoji: "💰", color: "#9BE15D" },
  { name: "Refund", emoji: "↩️", color: "#8BD3DD" },
  { name: "Other", emoji: "❓", color: "#9A9A9A" },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));
export const catEmoji = (c: string) => CAT[c]?.emoji ?? "❓";
export const catColor = (c: string) => CAT[c]?.color ?? "#9A9A9A";

// Seed merchant knowledge (tier 3). Deliberately does NOT know bharatpe / paytmqr
// street vendors so the correction loop has something to learn.
export const SEED_MAP: [RegExp, string][] = [
  [/swiggy\s*insta|instamart/i, "Groceries"],
  [/swiggy|zomato|eatsure|dominos|faasos/i, "Food delivery"],
  [/zepto|blinkit|bigbasket|dmart|jiomart|more retail/i, "Groceries"],
  [/uber|rapido|ola|namma\s*yatri|metro/i, "Transport"],
  [/hpcl|bpcl|indian\s*oil|petrol|fuel/i, "Transport"],
  [/netflix|spotify|hotstar|youtube|prime\s*video|cult\.?fit|cultfit|sonyliv|zee5|apple\.com/i, "Subscriptions"],
  [/amazon|myntra|flipkart|ajio|nykaa|meesho|decathlon/i, "Shopping"],
  [/irctc|makemytrip|goibibo|indigo|redbus|cleartrip/i, "Travel"],
  [/airtel|jio|vodafone|vi\s|bescom|electricity|bwssb|gas|act\s*fibernet/i, "Bills & utilities"],
  [/salary|sal\s*cr|payroll/i, "Salary"],
  [/apollo|pharmeasy|1mg|netmeds|practo|hospital|clinic/i, "Health"],
  [/sip|mutual\s*fund|groww|zerodha|kuvera|bse\s*star|nach.*mf/i, "SIP/Investments"],
  [/emi|bajaj\s*fin|home\s*credit|loan/i, "EMI"],
  [/rent|landlord|nobroker/i, "Rent"],
  [/starbucks|third\s*wave|truffles|social|toit|barbeque|cafe/i, "Dining out"],
  [/refund|reversed|reversal/i, "Refund"],
];

export const BRAND: [RegExp, string][] = [
  [/swiggy\s*insta|instamart/i, "Swiggy Instamart"],
  [/swiggy/i, "Swiggy"],
  [/zomato/i, "Zomato"],
  [/zepto/i, "Zepto"],
  [/blinkit/i, "Blinkit"],
  [/bigbasket/i, "BigBasket"],
  [/rapido/i, "Rapido"],
  [/uber/i, "Uber"],
  [/netflix/i, "Netflix"],
  [/spotify/i, "Spotify"],
  [/hotstar/i, "Hotstar"],
  [/youtube/i, "YouTube Premium"],
  [/cult/i, "Cult.fit"],
  [/amazon/i, "Amazon"],
  [/myntra/i, "Myntra"],
  [/irctc/i, "IRCTC"],
  [/airtel/i, "Airtel"],
  [/bescom/i, "BESCOM"],
  [/apollo/i, "Apollo Pharmacy"],
];
