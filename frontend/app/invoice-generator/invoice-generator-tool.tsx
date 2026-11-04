"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  FileText,
  Printer,
  Download,
  Share2,
  Plus,
  Trash2,
  Upload,
  RotateCcw,
  Sparkles,
  QrCode,
  Building,
  User,
  Percent,
  CheckCircle2,
  CreditCard,
  Palette,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { useHistory } from "@/lib/use-history";
import {
  ACCENT_COLORS,
  DEFAULT_INVOICE,
  DiscountType,
  InvoiceData,
  InvoiceItem,
  InvoiceStatus,
  PaymentMethodType,
  SAMPLE_TEMPLATES,
  INVOICE_TEMPLATES_LIST,
  SUPPORTED_CURRENCIES,
  buildPaymentPayload,
  calculateInvoiceTotals,
  formatMoney,
  generatePaymentQrDataUrl,
} from "@/lib/invoice-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function InvoiceGeneratorTool() {
  const {
    state: invoice,
    set: setInvoice,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<InvoiceData>(DEFAULT_INVOICE);

  const [activeTab, setActiveTab] = useState<"details" | "items" | "payment" | "styling">("details");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const invoiceSheetRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputId = useId();

  // Draft auto-recovery hook
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<InvoiceData>(
    "invoice-generator",
    invoice,
    setInvoice,
  );

  // Financial calculations
  const totals = calculateInvoiceTotals(invoice);

  // Generate Payment QR code whenever payment details or total changes
  useEffect(() => {
    let active = true;
    const payload = buildPaymentPayload(invoice, totals.total);
    if (!payload) {
      setQrCodeUrl(null);
      return;
    }

    generatePaymentQrDataUrl(payload).then((url) => {
      if (active) setQrCodeUrl(url);
    });

    return () => {
      active = false;
    };
  }, [invoice.paymentType, invoice.paymentDetails, totals.total, invoice.currencyCode, invoice.currencySymbol, invoice.senderName, invoice.invoiceNumber]);

  // Handle Logo Upload
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setInvoice((prev) => ({ ...prev, senderLogoUrl: e.target?.result as string }));
        toast.success("Uploaded company logo!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Item
  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      description: "New Service or Product Item",
      quantity: 1,
      unitPrice: 100,
    };
    setInvoice((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  // Update Item
  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    if (invoice.items.length <= 1) {
      toast.error("An invoice must contain at least 1 item.");
      return;
    }
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  // Print or Save as Vector PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // Download high-resolution PNG image
  const handleDownloadPng = async () => {
    if (!invoiceSheetRef.current) return;
    try {
      setIsExporting(true);
      toast.info("Generating high-resolution invoice image...");

      const canvas = await html2canvas(invoiceSheetRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber || "invoice"}.png`;
      a.click();
      toast.success("Downloaded invoice PNG!");
    } catch {
      toast.error("Failed to render invoice image.");
    } finally {
      setIsExporting(false);
    }
  };

  // Web Share
  const handleShare = async () => {
    if (!invoiceSheetRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(invoiceSheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const ok = await shareBlob(blob, `${invoice.invoiceNumber}.png`, {
          title: `Invoice ${invoice.invoiceNumber}`,
          text: `Invoice from ${invoice.senderName} for ${formatMoney(totals.total, invoice.currencySymbol)}`,
        });
        if (ok) toast.success("Shared invoice!");
      }, "image/png");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Print CSS style block */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-invoice-sheet,
          #print-invoice-sheet * {
            visibility: visible;
          }
          #print-invoice-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          header,
          footer,
          nav,
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6 no-print">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <FileText className="h-3.5 w-3.5" />
          Professional Billing & Accounting
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Smart In-Browser Invoice & Receipt Builder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Create, customize, and print client invoices with logo branding, automatic tax calculations, payment QR codes, and vector PDF export. 100% private in-browser.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
        className="no-print"
      />

      {/* Action Bar */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs font-bold text-foreground mr-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Templates:
          </span>
          {INVOICE_TEMPLATES_LIST.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                if (SAMPLE_TEMPLATES[tmpl.id]) {
                  setInvoice(SAMPLE_TEMPLATES[tmpl.id]);
                  toast.success(`Loaded "${tmpl.name}" invoice template!`);
                }
              }}
              className="rounded-xl border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/60 hover:bg-muted transition"
            >
              {tmpl.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center overflow-hidden rounded-xl border border-border/60 bg-background text-xs font-bold">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-35"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="flex items-center gap-1 border-l border-border/60 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-35"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </button>
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            title="Share via mobile or desktop"
          >
            <Share2 className="h-3.5 w-3.5 text-sky-400" />
            Share
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition hover:scale-105"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Live WYSIWYG Invoice Document */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="overflow-x-auto rounded-3xl border border-border/80 bg-neutral-900/60 p-4 sm:p-6 shadow-2xl">
            {/* The Actual Invoice Sheet (A4 Proportion) */}
            <div
              id="print-invoice-sheet"
              ref={invoiceSheetRef}
              className="mx-auto min-h-[900px] w-full max-w-[780px] rounded-2xl bg-white p-8 sm:p-12 text-neutral-900 shadow-xl transition-all"
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {/* Top Banner Accent Line */}
              <div
                className="h-2 w-full rounded-t-lg -mt-8 -mx-8 sm:-mt-12 sm:-mx-12 mb-8"
                style={{
                  backgroundColor: invoice.accentColor,
                  width: "calc(100% + 4rem)",
                }}
              />

              {/* Invoice Header: Company & Invoice Info */}
              <div className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-100 pb-8">
                {/* Logo & Sender Info */}
                <div className="space-y-3 max-w-[340px]">
                  {invoice.senderLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={invoice.senderLogoUrl}
                      alt="Company Logo"
                      className="max-h-14 max-w-[180px] object-contain rounded"
                    />
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="no-print inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 hover:border-neutral-500 hover:bg-neutral-100"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Add Company Logo
                    </div>
                  )}

                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                      {invoice.senderName || "Your Company Name"}
                    </h2>
                    <p className="mt-1 text-xs whitespace-pre-line text-neutral-500 leading-relaxed">
                      {invoice.senderAddress}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {invoice.senderEmail} {invoice.senderPhone ? `• ${invoice.senderPhone}` : ""}
                    </p>
                    {invoice.senderTaxId && (
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        Tax ID: {invoice.senderTaxId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Title & Meta */}
                <div className="text-right space-y-2">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          invoice.status === "paid"
                            ? "#ecfdf5"
                            : invoice.status === "overdue"
                            ? "#fef2f2"
                            : "#f8fafc",
                        color:
                          invoice.status === "paid"
                            ? "#059669"
                            : invoice.status === "overdue"
                            ? "#dc2626"
                            : "#475569",
                        border: `1px solid ${
                          invoice.status === "paid"
                            ? "#a7f3d0"
                            : invoice.status === "overdue"
                            ? "#fecaca"
                            : "#e2e8f0"
                        }`,
                      }}
                    >
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>

                  <h1
                    className="text-3xl font-black tracking-tight"
                    style={{ color: invoice.accentColor }}
                  >
                    INVOICE
                  </h1>

                  <div className="text-xs space-y-1 text-neutral-600">
                    <div>
                      <span className="font-semibold text-neutral-400">Invoice #: </span>
                      <span className="font-mono font-bold text-neutral-900">
                        {invoice.invoiceNumber}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-400">Issue Date: </span>
                      <span className="font-medium text-neutral-900">{invoice.issueDate}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-400">Due Date: </span>
                      <span className="font-medium text-neutral-900">{invoice.dueDate}</span>
                    </div>
                    {invoice.poNumber && (
                      <div>
                        <span className="font-semibold text-neutral-400">PO #: </span>
                        <span className="font-mono text-neutral-700">{invoice.poNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill To Section */}
              <div className="my-8">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  Billed To
                </span>
                <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-100 max-w-sm">
                  <h3 className="text-sm font-bold text-neutral-900">
                    {invoice.clientName || "Client / Company Name"}
                  </h3>
                  <p className="mt-1 text-xs whitespace-pre-line text-neutral-600 leading-relaxed">
                    {invoice.clientAddress || "Client Street Address\nCity, State, Postal Code"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {invoice.clientEmail} {invoice.clientPhone ? `• ${invoice.clientPhone}` : ""}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="my-8 overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead
                    className="text-white"
                    style={{ backgroundColor: invoice.accentColor }}
                  >
                    <tr>
                      <th className="py-3 px-4 font-bold">Item Description</th>
                      <th className="py-3 px-4 text-center font-bold w-16">Qty</th>
                      <th className="py-3 px-4 text-right font-bold w-24">Rate</th>
                      <th className="py-3 px-4 text-right font-bold w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {invoice.items.map((item, idx) => {
                      const amount = item.quantity * item.unitPrice;
                      return (
                        <tr key={item.id} className={idx % 2 === 1 ? "bg-neutral-50/50" : ""}>
                          <td className="py-3.5 px-4 font-medium text-neutral-900">
                            {item.description}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-neutral-600">
                            {item.quantity}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-neutral-600">
                            {formatMoney(item.unitPrice, invoice.currencySymbol)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-neutral-900">
                            {formatMoney(amount, invoice.currencySymbol)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Payment Row */}
              <div className="flex flex-wrap items-start justify-between gap-6 pt-4 border-t border-neutral-100">
                {/* Payment QR Code & Method */}
                <div className="max-w-[280px]">
                  {qrCodeUrl ? (
                    <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeUrl}
                        alt="Scan to Pay QR Code"
                        className="h-24 w-24 rounded border border-neutral-300 bg-white p-1"
                      />
                      <div className="text-[11px] space-y-1">
                        <span className="font-bold text-neutral-900 block flex items-center gap-1">
                          <QrCode className="h-3 w-3 text-neutral-500" />
                          Scan to Pay
                        </span>
                        <p className="text-neutral-500 capitalize">
                          Via {invoice.paymentType.toUpperCase()}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-600 break-all leading-tight">
                          {invoice.paymentDetails}
                        </p>
                      </div>
                    </div>
                  ) : invoice.paymentDetails ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
                      <span className="font-bold text-neutral-900 block mb-1">Payment Method</span>
                      <p className="text-neutral-600 font-mono text-[11px] whitespace-pre-line">
                        {invoice.paymentDetails}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Calculation Breakdown */}
                <div className="w-full max-w-[280px] space-y-2 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Subtotal:</span>
                    <span className="font-medium text-neutral-900 tabular-nums">
                      {formatMoney(totals.subtotal, invoice.currencySymbol)}
                    </span>
                  </div>

                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>
                        Discount ({invoice.discountType === "percent" ? `${invoice.discountValue}%` : "Fixed"}):
                      </span>
                      <span className="font-medium tabular-nums">
                        -{formatMoney(totals.discountAmount, invoice.currencySymbol)}
                      </span>
                    </div>
                  )}

                  {totals.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">{invoice.taxLabel} ({invoice.taxRate}%):</span>
                      <span className="font-medium text-neutral-900 tabular-nums">
                        +{formatMoney(totals.taxAmount, invoice.currencySymbol)}
                      </span>
                    </div>
                  )}

                  {totals.shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Shipping / Handling:</span>
                      <span className="font-medium text-neutral-900 tabular-nums">
                        +{formatMoney(totals.shipping, invoice.currencySymbol)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-neutral-900">
                    <span>Total Due:</span>
                    <span style={{ color: invoice.accentColor }} className="tabular-nums">
                      {formatMoney(totals.total, invoice.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms Footer */}
              <div className="mt-12 pt-6 border-t border-neutral-100 text-xs text-neutral-500 space-y-2">
                {invoice.notes && (
                  <div>
                    <span className="font-bold text-neutral-700">Notes: </span>
                    <span>{invoice.notes}</span>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <span className="font-bold text-neutral-700">Payment Terms: </span>
                    <span>{invoice.terms}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer & Settings Tabs */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4 no-print">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
            {/* Tab Navigation */}
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/40 p-1 text-xs">
              {[
                { id: "details", label: "Parties", icon: Building },
                { id: "items", label: "Items", icon: Plus },
                { id: "payment", label: "Payment", icon: CreditCard },
                { id: "styling", label: "Theme", icon: Palette },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-center gap-1 rounded-lg py-2 transition-all font-semibold ${
                      isSelected
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Parties (Sender & Client) */}
            {activeTab === "details" && (
              <div className="space-y-4 animate-in fade-in">
                {/* Logo Uploader */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Company Logo
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {invoice.senderLogoUrl ? "Change Logo" : "Upload Logo"}
                    </button>
                    {invoice.senderLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setInvoice({ ...invoice, senderLogoUrl: null })}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      id={logoInputId}
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    />
                  </div>
                </div>

                {/* Sender Details */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground block">
                    Your Business (Sender)
                  </span>
                  <input
                    type="text"
                    value={invoice.senderName}
                    onChange={(e) => setInvoice({ ...invoice, senderName: e.target.value })}
                    placeholder="Your Business Name"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={invoice.senderEmail}
                    onChange={(e) => setInvoice({ ...invoice, senderEmail: e.target.value })}
                    placeholder="Billing Email"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium"
                  />
                  <textarea
                    rows={2}
                    value={invoice.senderAddress}
                    onChange={(e) => setInvoice({ ...invoice, senderAddress: e.target.value })}
                    placeholder="Street Address, City, Postal Code"
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={invoice.senderTaxId}
                    onChange={(e) => setInvoice({ ...invoice, senderTaxId: e.target.value })}
                    placeholder="Tax ID / VAT / GST / EIN Number"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono text-[11px]"
                  />
                </div>

                {/* Client Details */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="text-xs font-bold text-foreground block">
                    Client Details (Billed To)
                  </span>
                  <input
                    type="text"
                    value={invoice.clientName}
                    onChange={(e) => setInvoice({ ...invoice, clientName: e.target.value })}
                    placeholder="Client Company or Individual"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={invoice.clientEmail}
                    onChange={(e) => setInvoice({ ...invoice, clientEmail: e.target.value })}
                    placeholder="Client Email"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium"
                  />
                  <textarea
                    rows={2}
                    value={invoice.clientAddress}
                    onChange={(e) => setInvoice({ ...invoice, clientAddress: e.target.value })}
                    placeholder="Client Address"
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs font-medium"
                  />
                </div>

                {/* Invoice Meta */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Invoice #
                    </label>
                    <input
                      type="text"
                      value={invoice.invoiceNumber}
                      onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Status
                    </label>
                    <select
                      value={invoice.status}
                      onChange={(e) => setInvoice({ ...invoice, status: e.target.value as InvoiceStatus })}
                      className="w-full h-8 rounded-xl border border-border/60 bg-background px-2 text-xs font-semibold"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="draft">Draft</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={invoice.issueDate}
                      onChange={(e) => setInvoice({ ...invoice, issueDate: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={invoice.dueDate}
                      onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-background px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Items & Financial Adjustments */}
            {activeTab === "items" && (
              <div className="space-y-4 animate-in fade-in">
                {/* Currency Selector */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Currency
                  </label>
                  <select
                    value={invoice.currencyCode}
                    onChange={(e) => {
                      const match = SUPPORTED_CURRENCIES.find((c) => c.code === e.target.value);
                      if (match) {
                        setInvoice({
                          ...invoice,
                          currencyCode: match.code,
                          currencySymbol: match.symbol,
                        });
                      }
                    }}
                    className="w-full h-9 rounded-xl border border-border/60 bg-background px-3 text-xs font-medium"
                  >
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Line Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Invoice Items</span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {invoice.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border/60 bg-background/50 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground font-bold">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                          placeholder="Item Description"
                          className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, "quantity", Number(e.target.value))}
                              className="w-full rounded-lg border border-border/60 bg-background px-2 py-1 text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">
                              Unit Price ({invoice.currencySymbol})
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, "unitPrice", Number(e.target.value))}
                              className="w-full rounded-lg border border-border/60 bg-background px-2 py-1 text-xs tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Taxes & Discounts */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={invoice.taxRate}
                        onChange={(e) => setInvoice({ ...invoice, taxRate: Number(e.target.value) })}
                        className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Tax Label
                      </label>
                      <input
                        type="text"
                        value={invoice.taxLabel}
                        onChange={(e) => setInvoice({ ...invoice, taxLabel: e.target.value })}
                        placeholder="VAT / GST / Sales Tax"
                        className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={invoice.discountValue}
                        onChange={(e) => setInvoice({ ...invoice, discountValue: Number(e.target.value) })}
                        className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Discount Type
                      </label>
                      <select
                        value={invoice.discountType}
                        onChange={(e) => setInvoice({ ...invoice, discountType: e.target.value as DiscountType })}
                        className="w-full h-8 rounded-xl border border-border/60 bg-background px-2 text-xs"
                      >
                        <option value="percent">Percentage (%)</option>
                        <option value="fixed">Fixed ({invoice.currencySymbol})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Payment QR & Notes */}
            {activeTab === "payment" && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Payment QR & Method
                  </label>
                  <select
                    value={invoice.paymentType}
                    onChange={(e) => setInvoice({ ...invoice, paymentType: e.target.value as PaymentMethodType })}
                    className="w-full h-9 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold"
                  >
                    <option value="paypal">PayPal (paypal.me link or email)</option>
                    <option value="upi">UPI / Instant Mobile Pay (UPI ID / VPA)</option>
                    <option value="bank">Bank Wire / IBAN</option>
                    <option value="crypto">Cryptocurrency Address (BTC / ETH / USDT)</option>
                    <option value="custom">Custom Payment URL</option>
                    <option value="none">None (Hide Payment Section)</option>
                  </select>
                </div>

                {invoice.paymentType !== "none" && (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Payment Account / Link / Address
                    </label>
                    <input
                      type="text"
                      value={invoice.paymentDetails}
                      onChange={(e) => setInvoice({ ...invoice, paymentDetails: e.target.value })}
                      placeholder="e.g. yourhandle@okaxis, paypal.me/handle, or IBAN"
                      className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Automatically converts into a scan-to-pay QR code on the invoice sheet.
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/60">
                  <label className="text-xs font-bold text-foreground block">
                    Notes & Client Memo
                  </label>
                  <textarea
                    rows={2}
                    value={invoice.notes}
                    onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                    placeholder="Thank you for your business..."
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    Payment Terms
                  </label>
                  <textarea
                    rows={2}
                    value={invoice.terms}
                    onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                    placeholder="Payment due within 14 days..."
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Styling & Accent Colors */}
            {activeTab === "styling" && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-2">
                    Brand Accent Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCENT_COLORS.map((col) => {
                      const isSelected = invoice.accentColor === col.value;
                      return (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setInvoice({ ...invoice, accentColor: col.value })}
                          className={`flex items-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                              : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: col.value }}
                          />
                          <span className="truncate">{col.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <label className="text-xs font-bold text-foreground block mb-2">
                    Custom Hex Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={invoice.accentColor}
                      onChange={(e) => setInvoice({ ...invoice, accentColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1"
                    />
                    <input
                      type="text"
                      value={invoice.accentColor}
                      onChange={(e) => setInvoice({ ...invoice, accentColor: e.target.value })}
                      className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
