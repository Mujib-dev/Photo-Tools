/**
 * AI Form & Receipt Parser
 * Extracts structured financial and document fields (Vendor, Total, Tax, Date,
 * Invoice/Receipt #, Line Items, Payment Method) from raw OCR text.
 */

export type ReceiptCategory =
  | "Restaurant & Dining"
  | "Groceries & Supermarket"
  | "Fuel & Automotive"
  | "Travel & Lodging"
  | "Software & Technology"
  | "Office Supplies"
  | "Retail & Shopping"
  | "Utilities & Services"
  | "General Expense";

export interface ParsedLineItem {
  id?: string;
  description: string;
  quantity?: number;
  price?: number;
  total: number;
}

export interface ParsedReceiptData {
  vendor: string | null;
  category: ReceiptCategory;
  date: string | null;
  receiptNumber: string | null;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  taxRate?: string | null;
  tip?: number | null;
  total: number | null;
  paymentMethod: string | null;
  lineItems: ParsedLineItem[];
  rawText: string;
}

export function parseReceiptAndForm(text: string): ParsedReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let vendor: string | null = null;
  let date: string | null = null;
  let receiptNumber: string | null = null;
  let currency = "$";
  let subtotal: number | null = null;
  let tax: number | null = null;
  let tip: number | null = null;
  let total: number | null = null;
  let paymentMethod: string | null = null;
  const lineItems: ParsedLineItem[] = [];

  // Detect currency
  if (text.includes("€") || text.toLowerCase().includes("eur")) currency = "€";
  else if (text.includes("£") || text.toLowerCase().includes("gbp")) currency = "£";
  else if (text.includes("₹") || text.toLowerCase().includes("inr")) currency = "₹";
  else if (text.includes("¥") || text.toLowerCase().includes("jpy")) currency = "¥";
  else if (text.includes("CAD") || text.includes("USD") || text.includes("$")) currency = "$";

  // 1. Detect Vendor from the first 4 non-generic lines
  const genericHeaders = /receipt|invoice|bill|tax invoice|welcome|customer|cashier|order|store|terminal|copy/i;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (line.length > 2 && !genericHeaders.test(line) && !/^\d+$/.test(line) && !/\d{2}[\/\-]\d{2}/.test(line)) {
      vendor = line;
      break;
    }
  }

  // 2. Regex patterns
  const dateRegex = /(?:date|dated|on)?[:.]?\s*(\b\d{1,4}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b)/i;
  const invoiceRegex = /(?:invoice|receipt|order|bill|trans|txn|check)\s*(?:#|no|num|number|id)?[:.]?\s*([A-Za-z0-9\-_]{4,20})/i;
  const totalRegex = /(?:total|grand total|amount due|balance due|net total|final total)[\s:]*[$€£₹¥]?\s*(\d+[.,]\d{2})/i;
  const subtotalRegex = /(?:subtotal|sub total|sub-total|net amount)[\s:]*[$€£₹¥]?\s*(\d+[.,]\d{2})/i;
  const taxRegex = /(?:tax|vat|gst|hst|sales tax)[\s:]*[$€£₹¥]?\s*(\d+[.,]\d{2})/i;
  const tipRegex = /(?:tip|gratuity)[\s:]*[$€£₹¥]?\s*(\d+[.,]\d{2})/i;
  const paymentRegex = /\b(visa|mastercard|amex|american express|apple pay|google pay|debit|credit|cash|paypal)\b/i;

  // Amount parser helper
  const parseNum = (str: string): number => {
    return parseFloat(str.replace(/,/g, "."));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Date
    if (!date) {
      const dMatch = line.match(dateRegex);
      if (dMatch) date = dMatch[1];
    }

    // Invoice/Receipt #
    if (!receiptNumber) {
      const invMatch = line.match(invoiceRegex);
      if (invMatch) receiptNumber = invMatch[1];
    }

    // Payment Method
    if (!paymentMethod) {
      const payMatch = line.match(paymentRegex);
      if (payMatch) paymentMethod = payMatch[1].toUpperCase();
    }

    // Subtotal
    if (subtotal === null) {
      const subMatch = line.match(subtotalRegex);
      if (subMatch) subtotal = parseNum(subMatch[1]);
    }

    // Tax
    if (tax === null) {
      const taxMatch = line.match(taxRegex);
      if (taxMatch) tax = parseNum(taxMatch[1]);
    }

    // Tip
    if (tip === null) {
      const tipMatch = line.match(tipRegex);
      if (tipMatch) tip = parseNum(tipMatch[1]);
    }

    // Total
    const totMatch = line.match(totalRegex);
    if (totMatch) {
      total = parseNum(totMatch[1]);
    }

    // Line items detection: e.g. "Coffee 4.50" or "2 x Bagel 6.00" or "Item Name ... 12.99"
    const lineItemMatch = line.match(/^(?:(\d+)\s*[xX*]\s*)?(.+?)\s+[$€£₹¥]?\s*(\d+[.,]\d{2})$/);
    if (
      lineItemMatch &&
      !totalRegex.test(line) &&
      !subtotalRegex.test(line) &&
      !taxRegex.test(line) &&
      !tipRegex.test(line) &&
      !/balance|change|cash|visa|card|sub/i.test(line)
    ) {
      const qty = lineItemMatch[1] ? parseInt(lineItemMatch[1], 10) : 1;
      const desc = lineItemMatch[2].trim();
      const itemTot = parseNum(lineItemMatch[3]);
      if (desc.length > 1 && !/^\d+$/.test(desc)) {
        lineItems.push({
          id: `item-${i}`,
          description: desc,
          quantity: qty,
          price: qty > 1 ? parseFloat((itemTot / qty).toFixed(2)) : itemTot,
          total: itemTot,
        });
      }
    }
  }

  // Deduce category
  let category: ReceiptCategory = "General Expense";
  const lower = text.toLowerCase();
  if (/restaurant|cafe|coffee|diner|bar|grill|burger|pizza|kitchen|bistro|starbucks|mcdonald|food|menu/i.test(lower)) {
    category = "Restaurant & Dining";
  } else if (/supermarket|grocery|market|walmart|kroger|costco|trader joe|target|whole foods/i.test(lower)) {
    category = "Groceries & Supermarket";
  } else if (/gas|fuel|petrol|shell|chevron|exxon|bp|oil|auto|valvoline|parking/i.test(lower)) {
    category = "Fuel & Automotive";
  } else if (/hotel|inn|motel|resort|airbnb|airline|flight|uber|lyft|taxi|transit/i.test(lower)) {
    category = "Travel & Lodging";
  } else if (/aws|google cloud|azure|github|figma|slack|notion|openai|microsoft|adobe|digitalocean|software|saas/i.test(lower)) {
    category = "Software & Technology";
  } else if (/staples|office depot|paper|stationery|printing/i.test(lower)) {
    category = "Office Supplies";
  } else if (/electric|water|power|energy|utility|internet|telecom|verizon|at&t|t-mobile/i.test(lower)) {
    category = "Utilities & Services";
  } else if (/clothing|shoes|apparel|electronics|best buy|home depot|ikea/i.test(lower)) {
    category = "Retail & Shopping";
  }

  const taxRate = subtotal && tax && subtotal > 0 ? `${((tax / subtotal) * 100).toFixed(1)}%` : null;

  return {
    vendor,
    category,
    date,
    receiptNumber,
    currency,
    subtotal,
    tax,
    taxRate,
    tip,
    total,
    paymentMethod,
    lineItems,
    rawText: text,
  };
}

export function receiptToCsv(data: ParsedReceiptData): string {
  const rows: string[][] = [
    ["Vendor", data.vendor || "N/A"],
    ["Date", data.date || "N/A"],
    ["Receipt/Invoice #", data.receiptNumber || "N/A"],
    ["Payment Method", data.paymentMethod || "N/A"],
    ["Subtotal", data.subtotal !== null ? `${data.currency}${data.subtotal}` : "N/A"],
    ["Tax", data.tax !== null ? `${data.currency}${data.tax}` : "N/A"],
    ["Total", data.total !== null ? `${data.currency}${data.total}` : "N/A"],
    [],
    ["Item Description", "Qty", "Unit Price", "Total"],
  ];

  for (const item of data.lineItems) {
    rows.push([
      `"${item.description.replace(/"/g, '""')}"`,
      String(item.quantity ?? 1),
      item.price ? `${data.currency}${item.price}` : "",
      `${data.currency}${item.total}`,
    ]);
  }

  return rows.map((r) => r.join(",")).join("\n");
}
