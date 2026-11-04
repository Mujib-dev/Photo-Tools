/**
 * Smart In-Browser Invoice & Receipt Engine
 *
 * Full financial calculation, currency formatting, payment QR generation,
 * and vector layout modeling for professional client invoices and receipts.
 */

import QRCode from "qrcode";

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue";
export type DiscountType = "percent" | "fixed";
export type PaymentMethodType = "none" | "paypal" | "upi" | "bank" | "crypto" | "custom";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  // Document metadata
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  status: InvoiceStatus;

  // Sender / Company
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderAddress: string;
  senderTaxId: string;
  senderLogoUrl: string | null;

  // Client / Bill-to
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;

  // Currency & Items
  currencySymbol: string;
  currencyCode: string;
  items: InvoiceItem[];

  // Taxes & Adjustments
  taxRate: number; // percentage (e.g. 10 for 10%)
  taxLabel: string; // e.g. "VAT", "GST", "Sales Tax"
  discountType: DiscountType;
  discountValue: number;
  shippingFee: number;

  // Payment & Terms
  paymentType: PaymentMethodType;
  paymentDetails: string; // PayPal email, UPI ID, IBAN, Crypto wallet, or URL
  notes: string;
  terms: string;

  // Styling
  accentColor: string;
  template: "modern" | "classic" | "minimal";
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee" },
  { code: "CAD", symbol: "CA$", label: "CAD (CA$) - Canadian Dollar" },
  { code: "AUD", symbol: "AU$", label: "AUD (AU$) - Australian Dollar" },
  { code: "JPY", symbol: "¥", label: "JPY (¥) - Japanese Yen" },
  { code: "CHF", symbol: "CHF", label: "CHF - Swiss Franc" },
  { code: "AED", symbol: "AED", label: "AED - UAE Dirham" },
  { code: "SGD", symbol: "SG$", label: "SGD (SG$) - Singapore Dollar" },
];

export const ACCENT_COLORS = [
  { name: "Navy", value: "#1e3a8a" },
  { name: "Emerald", value: "#059669" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Slate", value: "#0f172a" },
  { name: "Rose", value: "#e11d48" },
  { name: "Amber", value: "#d97706" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Teal", value: "#0d9488" },
  { name: "Crimson", value: "#be123c" },
  { name: "Cyan", value: "#0284c7" },
  { name: "Orange", value: "#ea580c" },
  { name: "Purple", value: "#9333ea" },
];

export const DEFAULT_INVOICE: InvoiceData = {
  invoiceNumber: "INV-2026-001",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  poNumber: "PO-8821",
  status: "pending",

  senderName: "Studio Pulse Creative",
  senderEmail: "billing@studiopulse.design",
  senderPhone: "+1 (555) 321-7890",
  senderAddress: "742 Evergreen Terrace, Suite 400\nSan Francisco, CA 94107",
  senderTaxId: "US-EIN-94-3829101",
  senderLogoUrl: null,

  clientName: "Acme Global Technologies",
  clientEmail: "accounts@acmeglobal.com",
  clientPhone: "+1 (555) 987-6543",
  clientAddress: "100 Market Street, 12th Floor\nSan Francisco, CA 94105",

  currencySymbol: "$",
  currencyCode: "USD",
  items: [
    {
      id: "item-1",
      description: "Brand Identity Design & Interactive Design System",
      quantity: 1,
      unitPrice: 2800,
    },
    {
      id: "item-2",
      description: "Mobile App UI/UX Wireframing & High-Fidelity Prototypes",
      quantity: 40,
      unitPrice: 75,
    },
    {
      id: "item-3",
      description: "Cloud Deployment & Production Launch Support",
      quantity: 1,
      unitPrice: 650,
    },
  ],

  taxRate: 8.5,
  taxLabel: "State Tax",
  discountType: "percent",
  discountValue: 5,
  shippingFee: 0,

  paymentType: "paypal",
  paymentDetails: "https://paypal.me/studiopulse",
  notes: "Thank you for your partnership! Please send wire or online payments before the due date.",
  terms: "Payment due within 14 days of issue. Late payments incur a 1.5% monthly service fee.",

  accentColor: "#1e3a8a",
  template: "modern",
};

export const SAMPLE_TEMPLATES: Record<string, InvoiceData> = {
  agency: {
    ...DEFAULT_INVOICE,
  },
  freelancer: {
    ...DEFAULT_INVOICE,
    invoiceNumber: "INV-FL-104",
    senderName: "Alex Vance (UX Consultant)",
    senderEmail: "alex@vanceux.com",
    senderAddress: "Brooklyn, New York, NY",
    clientName: "Northstar Mobile Labs",
    clientEmail: "finance@northstarlabs.io",
    items: [
      { id: "1", description: "iOS App Usability Audit & Accessibility Testing", quantity: 1, unitPrice: 1500 },
      { id: "2", description: "Figma Component Library Re-architecture", quantity: 24, unitPrice: 65 },
    ],
    taxRate: 0,
    discountValue: 0,
    accentColor: "#059669",
    paymentType: "upi",
    paymentDetails: "alexvance@okaxis",
  },
  photography: {
    ...DEFAULT_INVOICE,
    invoiceNumber: "REC-2026-44",
    senderName: "Lumina Photography & Studio",
    senderEmail: "bookings@luminastudio.com",
    senderAddress: "12 King Street, London, UK",
    clientName: "Vogue Collective UK",
    clientEmail: "accounts@voguecollective.co.uk",
    currencyCode: "GBP",
    currencySymbol: "£",
    items: [
      { id: "1", description: "Full Day Commercial Studio Photography Session", quantity: 1, unitPrice: 1200 },
      { id: "2", description: "High-End Retouching & Color Grading (25 Deliverables)", quantity: 25, unitPrice: 20 },
      { id: "3", description: "Commercial Royalty-Free Digital Licensing", quantity: 1, unitPrice: 350 },
    ],
    taxRate: 20,
    taxLabel: "VAT",
    discountValue: 0,
    accentColor: "#e11d48",
    paymentType: "bank",
    paymentDetails: "IBAN: GB29NWBK60161331926819",
  },
  saas: {
    ...DEFAULT_INVOICE,
    invoiceNumber: "INV-SaaS-902",
    senderName: "CloudScale Infrastructure Inc.",
    senderEmail: "billing@cloudscale.io",
    senderAddress: "500 Howard Street, San Francisco, CA 94105",
    clientName: "HyperGrowth Fintech Corp",
    clientEmail: "procurement@hypergrowth.com",
    items: [
      { id: "1", description: "Enterprise Cloud Tier (Annual Dedicated Cluster)", quantity: 1, unitPrice: 4800 },
      { id: "2", description: "Additional API Compute Units (Tier 3 Overages)", quantity: 15, unitPrice: 120 },
      { id: "3", description: "24/7 Mission-Critical SLA & Dedicated Solutions Architect", quantity: 1, unitPrice: 950 },
    ],
    taxRate: 9.0,
    taxLabel: "State Cloud Tax",
    discountType: "percent",
    discountValue: 10,
    accentColor: "#4f46e5",
    paymentType: "bank",
    paymentDetails: "IBAN: US89CITI20000012345678",
    notes: "Automated recurring invoice. Thank you for scaling your core infrastructure with CloudScale.",
  },
  consulting: {
    ...DEFAULT_INVOICE,
    invoiceNumber: "ADV-2026-19",
    senderName: "Vantage Strategy Group LLC",
    senderEmail: "advisory@vantagestrategy.com",
    senderAddress: "40 Wall Street, 28th Floor, New York, NY 10005",
    clientName: "Aetheria Healthcare Partners",
    clientEmail: "ap@aetheriahealth.org",
    items: [
      { id: "1", description: "Monthly Executive Strategic Advisory Retainer", quantity: 1, unitPrice: 6500 },
      { id: "2", description: "Q2 Board Leadership Offsite Workshop & Facilitation", quantity: 1, unitPrice: 3200 },
    ],
    taxRate: 0,
    discountValue: 0,
    accentColor: "#0f172a",
    paymentType: "bank",
    paymentDetails: "Routing: 021000021 | Acct: 9876543210 (JPMorgan Chase)",
    terms: "Net 15 days. Wire transfers or ACH preferred.",
  },
  ecommerce: {
    ...DEFAULT_INVOICE,
    invoiceNumber: "ORD-88291",
    senderName: "Artisan Goods Wholesale Co.",
    senderEmail: "orders@artisangoods.store",
    senderAddress: "18 Industrial Way, Portland, OR 97201",
    clientName: "Pacific Coast Retailers",
    clientEmail: "purchasing@pacificretail.com",
    items: [
      { id: "1", description: "Organic Cold-Brew Concentrate (Case of 24 Units)", quantity: 50, unitPrice: 42 },
      { id: "2", description: "Eco-Friendly Insulated Tumblers (Carton of 50)", quantity: 10, unitPrice: 85 },
      { id: "3", description: "Custom Co-Branded Countertop Display Stands", quantity: 4, unitPrice: 120 },
    ],
    taxRate: 7.25,
    taxLabel: "Sales Tax",
    discountType: "percent",
    discountValue: 5,
    shippingFee: 185,
    accentColor: "#d97706",
    paymentType: "paypal",
    paymentDetails: "https://paypal.me/artisangoods",
    terms: "Net 30 days. All orders inspected before pallet freight dispatch.",
  },
};

export const INVOICE_TEMPLATES_LIST = [
  { id: "agency", name: "Design Agency", badge: "Agency" },
  { id: "freelancer", name: "Freelancer", badge: "Solo" },
  { id: "photography", name: "Photography", badge: "Studio" },
  { id: "saas", name: "SaaS & Cloud", badge: "Tech" },
  { id: "consulting", name: "Consulting", badge: "Advisory" },
  { id: "ecommerce", name: "Wholesale & Goods", badge: "Commerce" },
];

/**
 * Perform exact financial calculations for an invoice
 */
export function calculateInvoiceTotals(data: InvoiceData) {
  const subtotal = data.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  let discountAmount = 0;
  if (data.discountType === "percent") {
    discountAmount = (subtotal * Math.max(0, Math.min(100, data.discountValue))) / 100;
  } else {
    discountAmount = Math.max(0, Math.min(subtotal, data.discountValue));
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * Math.max(0, data.taxRate)) / 100;
  const shipping = Math.max(0, data.shippingFee || 0);
  const total = taxableAmount + taxAmount + shipping;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    shipping,
    total,
  };
}

/**
 * Format currency with commas and 2 decimals
 */
export function formatMoney(amount: number, symbol: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

/**
 * Construct Payment QR code string depending on the method
 */
export function buildPaymentPayload(data: InvoiceData, totalAmount: number): string | null {
  if (data.paymentType === "none" || !data.paymentDetails?.trim()) return null;

  const detail = data.paymentDetails.trim();

  if (data.paymentType === "upi") {
    // UPI format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR
    return `upi://pay?pa=${encodeURIComponent(detail)}&pn=${encodeURIComponent(data.senderName)}&am=${totalAmount.toFixed(2)}&cu=${data.currencyCode}`;
  }

  if (data.paymentType === "paypal") {
    if (detail.startsWith("http")) return detail;
    return `https://paypal.me/${encodeURIComponent(detail)}/${totalAmount.toFixed(2)}`;
  }

  if (data.paymentType === "bank") {
    return `IBAN: ${detail} | Ref: ${data.invoiceNumber} | Total: ${data.currencySymbol}${totalAmount.toFixed(2)}`;
  }

  if (data.paymentType === "crypto") {
    return detail;
  }

  return detail;
}

/**
 * Generate a PNG data URL for the payment QR code
 */
export async function generatePaymentQrDataUrl(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      margin: 1,
      width: 140,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Failed to generate QR code", err);
    return "";
  }
}
