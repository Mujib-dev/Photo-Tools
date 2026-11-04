"use client";

import * as React from "react";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Hash,
  Loader2,
  Plus,
  Receipt,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeOcr } from "@/lib/api";
import {
  parseReceiptAndForm,
  receiptToCsv,
  type ParsedLineItem,
  type ParsedReceiptData,
  type ReceiptCategory,
} from "@/lib/receipt-parser";
import { cn } from "@/lib/utils";

const SAMPLE_RECEIPT_TEXT = `BLUE BOTTLE COFFEE
Store #402 - Downtown Market
Tel: (415) 555-0199
Date: 2026-10-14 09:42 AM
Receipt #: REC-884920
Cashier: Sarah M.

1 x Flat White (Oat Milk)     5.50
1 x Avocado Toast              11.00
2 x Croissant                  8.00

Subtotal                      24.50
Tax (8.5%)                     2.08
Tip                            4.00
Total                         30.58

Paid via: APPLE PAY (Visa ....4910)
Thank you for visiting Blue Bottle!`;

export function ReceiptParserTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedReceiptData | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Clean up object URLs
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleProcessFile = async (f: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setIsProcessing(true);
    setError(null);

    try {
      const ocrResult = await analyzeOcr(f);
      const data = parseReceiptAndForm(ocrResult.fullText);
      setParsedData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse receipt.";
      setError(`${msg} (You can also try our demo sample below)`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSample = () => {
    const data = parseReceiptAndForm(SAMPLE_RECEIPT_TEXT);
    setParsedData(data);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  // Line item mutation helpers
  const handleUpdateItem = (index: number, field: keyof ParsedLineItem, val: string | number) => {
    if (!parsedData) return;
    const updated = [...parsedData.lineItems];
    updated[index] = { ...updated[index], [field]: val };

    // Recalculate item total if qty or price changed
    if (field === "quantity" || field === "price") {
      const qty = Number(updated[index].quantity) || 1;
      const price = Number(updated[index].price) || 0;
      updated[index].total = parseFloat((qty * price).toFixed(2));
    }

    // Recalculate subtotal & total
    const newSubtotal = updated.reduce((sum, item) => sum + (item.total || 0), 0);
    const tax = parsedData.tax || 0;
    const tip = parsedData.tip || 0;

    setParsedData({
      ...parsedData,
      lineItems: updated,
      subtotal: parseFloat(newSubtotal.toFixed(2)),
      total: parseFloat((newSubtotal + tax + tip).toFixed(2)),
    });
  };

  const handleAddItem = () => {
    if (!parsedData) return;
    const newItem: ParsedLineItem = {
      id: `item-${Date.now()}`,
      description: "New Item",
      quantity: 1,
      price: 0,
      total: 0,
    };
    setParsedData({
      ...parsedData,
      lineItems: [...parsedData.lineItems, newItem],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!parsedData) return;
    const updated = parsedData.lineItems.filter((_, i) => i !== index);
    const newSubtotal = updated.reduce((sum, item) => sum + (item.total || 0), 0);
    const tax = parsedData.tax || 0;
    const tip = parsedData.tip || 0;

    setParsedData({
      ...parsedData,
      lineItems: updated,
      subtotal: parseFloat(newSubtotal.toFixed(2)),
      total: parseFloat((newSubtotal + tax + tip).toFixed(2)),
    });
  };

  // Export handlers
  const handleDownloadCsv = () => {
    if (!parsedData) return;
    const csvContent = receiptToCsv(parsedData);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(parsedData.vendor || "receipt").toLowerCase().replace(/\s+/g, "-")}-expense.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!parsedData) return;
    const jsonStr = JSON.stringify(parsedData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(parsedData.vendor || "receipt").toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    if (!parsedData) return;
    const lines = [
      `Merchant: ${parsedData.vendor || "N/A"}`,
      `Category: ${parsedData.category}`,
      `Date: ${parsedData.date || "N/A"}`,
      `Receipt #: ${parsedData.receiptNumber || "N/A"}`,
      `Subtotal: ${parsedData.currency}${parsedData.subtotal ?? 0}`,
      `Tax: ${parsedData.currency}${parsedData.tax ?? 0}`,
      `Tip: ${parsedData.currency}${parsedData.tip ?? 0}`,
      `Total: ${parsedData.currency}${parsedData.total ?? 0}`,
      "",
      "Items:",
      ...parsedData.lineItems.map(
        (it) => `- ${it.quantity}x ${it.description} (${parsedData.currency}${it.total})`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AuthGate>
      <div className="container max-w-5xl py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-3">
            <Receipt className="h-3.5 w-3.5" />
            AI Form & Receipt Financial Parser
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            AI Receipt & Invoice Financial Parser
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
            Scan restaurant receipts, retail bills, and B2B invoices. Automatically extract vendor,
            date, line items, taxes, and totals into Excel, CSV, or structured JSON for effortless expense reporting.
          </p>
        </div>

        {/* Upload & Workspace */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Upload / Document Preview */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
                <span>Upload Receipt or Bill</span>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="font-mono text-[11px] text-primary hover:underline cursor-pointer font-normal normal-case"
                >
                  Load Sample Demo
                </button>
              </h2>

              {!file && !previewUrl ? (
                <Dropzone
                  kind="document"
                  onFiles={(files) => {
                    if (files.length > 0) handleProcessFile(files[0]);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {file?.name || "Sample Receipt"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                        setParsedData(null);
                      }}
                      className="font-mono text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>

                  {previewUrl && (
                    <div className="relative max-h-96 overflow-hidden rounded-xl border border-outline-variant/25 bg-muted/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Receipt scan"
                        className="w-full h-auto object-contain max-h-96 mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-primary font-medium">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Neural OCR Extracting Financial Fields...
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Category breakdown hint */}
            <div className="rounded-xl border border-outline-variant/15 bg-muted/30 p-4 text-xs space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Supported Accounting Exports
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Compatible with QuickBooks, Xero, FreshBooks, Excel, and Google Sheets. All tax
                rates and currency conversions are preserved.
              </p>
            </div>
          </div>

          {/* Right Column: Parsed Financial Fields & Table */}
          <div className="space-y-6 lg:col-span-7">
            {parsedData ? (
              <div className="space-y-6">
                {/* Top Financial Summary Card */}
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Vendor / Merchant
                      </span>
                      <Input
                        value={parsedData.vendor || ""}
                        onChange={(e) => setParsedData({ ...parsedData, vendor: e.target.value })}
                        placeholder="Merchant Name"
                        className="font-display text-lg font-bold text-foreground mt-0.5 bg-muted/30"
                      />
                    </div>

                    <div className="flex flex-col sm:items-end">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Expense Category
                      </span>
                      <Select
                        value={parsedData.category}
                        onValueChange={(cat) =>
                          setParsedData({ ...parsedData, category: cat as ReceiptCategory })
                        }
                      >
                        <SelectTrigger className="mt-0.5 h-8 w-44 bg-muted/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Restaurant & Dining">🍽️ Restaurant & Dining</SelectItem>
                          <SelectItem value="Groceries & Supermarket">🛒 Groceries & Market</SelectItem>
                          <SelectItem value="Fuel & Automotive">⛽ Fuel & Automotive</SelectItem>
                          <SelectItem value="Travel & Lodging">✈️ Travel & Lodging</SelectItem>
                          <SelectItem value="Software & Technology">💻 Software & SaaS</SelectItem>
                          <SelectItem value="Office Supplies">📎 Office Supplies</SelectItem>
                          <SelectItem value="Retail & Shopping">🛍️ Retail & Shopping</SelectItem>
                          <SelectItem value="Utilities & Services">⚡ Utilities & Services</SelectItem>
                          <SelectItem value="General Expense">📦 General Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
                        <Calendar className="h-3 w-3" /> Date
                      </span>
                      <input
                        type="text"
                        value={parsedData.date || ""}
                        onChange={(e) => setParsedData({ ...parsedData, date: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        className="mt-1 w-full bg-transparent font-semibold text-foreground outline-none"
                      />
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
                        <Hash className="h-3 w-3" /> Ref / Inv #
                      </span>
                      <input
                        type="text"
                        value={parsedData.receiptNumber || ""}
                        onChange={(e) =>
                          setParsedData({ ...parsedData, receiptNumber: e.target.value })
                        }
                        placeholder="REC-001"
                        className="mt-1 w-full bg-transparent font-semibold text-foreground outline-none"
                      />
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
                        <CreditCard className="h-3 w-3" /> Payment
                      </span>
                      <input
                        type="text"
                        value={parsedData.paymentMethod || "CASH"}
                        onChange={(e) =>
                          setParsedData({ ...parsedData, paymentMethod: e.target.value })
                        }
                        placeholder="Card/Cash"
                        className="mt-1 w-full bg-transparent font-semibold text-foreground outline-none uppercase"
                      />
                    </div>

                    <div className="rounded-lg bg-primary/10 p-2.5 border border-primary/20">
                      <span className="flex items-center gap-1 text-[10px] text-primary uppercase font-bold">
                        Total Amount
                      </span>
                      <span className="mt-1 block text-base font-bold text-primary">
                        {parsedData.currency}
                        {parsedData.total !== null ? parsedData.total.toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Subtotal, Tax, Tip Breakdowns */}
                  <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-outline-variant/15 p-2 bg-muted/20">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {parsedData.currency}
                        {parsedData.subtotal !== null ? parsedData.subtotal.toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-outline-variant/15 p-2 bg-muted/20">
                      <span className="text-muted-foreground">
                        Tax {parsedData.taxRate ? `(${parsedData.taxRate})` : ""}:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {parsedData.currency}
                        {parsedData.tax !== null ? parsedData.tax.toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-outline-variant/15 p-2 bg-muted/20">
                      <span className="text-muted-foreground">Tip / Gratuity:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {parsedData.currency}
                        {parsedData.tip != null ? parsedData.tip.toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                      Itemized Line Items ({parsedData.lineItems.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-muted/60 px-2.5 py-1 font-mono text-xs text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Add Item
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-outline-variant/20 text-muted-foreground font-mono">
                          <th className="pb-2 font-normal">Description</th>
                          <th className="pb-2 text-center font-normal w-16">Qty</th>
                          <th className="pb-2 text-right font-normal w-24">Price</th>
                          <th className="pb-2 text-right font-normal w-24">Total</th>
                          <th className="pb-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {parsedData.lineItems.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-muted/30">
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateItem(idx, "description", e.target.value)
                                }
                                className="w-full bg-transparent font-medium text-foreground outline-none"
                              />
                            </td>
                            <td className="py-2 px-1 text-center font-mono">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity || 1}
                                onChange={(e) =>
                                  handleUpdateItem(idx, "quantity", Number(e.target.value))
                                }
                                className="w-12 text-center bg-transparent font-mono outline-none"
                              />
                            </td>
                            <td className="py-2 px-1 text-right font-mono">
                              <input
                                type="number"
                                step={0.01}
                                value={item.price || 0}
                                onChange={(e) =>
                                  handleUpdateItem(idx, "price", Number(e.target.value))
                                }
                                className="w-20 text-right bg-transparent font-mono outline-none"
                              />
                            </td>
                            <td className="py-2 pl-2 text-right font-mono font-semibold text-foreground">
                              {parsedData.currency}
                              {(item.total || 0).toFixed(2)}
                            </td>
                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Export Bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 font-display text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download CSV (Excel / Sheets)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 bg-muted/60 py-2.5 px-4 font-display text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyClipboard}
                    className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 bg-muted/60 py-2.5 px-4 font-display text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                  >
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy Summary"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/40 p-12 text-center space-y-3">
                <Receipt className="h-10 w-10 text-muted-foreground/60" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    No Receipt Loaded
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    Upload a receipt or invoice scan on the left, or test instantly with our pre-loaded demo sample.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 font-display text-xs font-semibold text-primary hover:bg-primary/20 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Load Sample Restaurant Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
