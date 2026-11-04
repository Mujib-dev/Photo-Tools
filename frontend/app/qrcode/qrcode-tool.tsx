"use client";

import * as React from "react";
import {
  Barcode,
  Camera,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  QrCode,
  RefreshCw,
  Scan,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  User,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/screenshot";
import { BarcodeTool } from "@/app/barcode/barcode-tool";
import {
  type EmailData,
  type QrErrorCorrection,
  type QrPayloadType,
  type QrStylingOptions,
  type ScanQrResult,
  type SmsData,
  type VCardData,
  type WifiData,
  DEFAULT_QR_STYLING,
  decodeQrFromImage,
  formatEmailPayload,
  formatSmsPayload,
  formatVCardPayload,
  formatWifiPayload,
  generateQrCanvas,
  generateQrSvg,
} from "@/lib/qrcode-engine";

export function QrCodeTool({
  initialTab = "generate",
}: {
  initialTab?: "generate" | "scan" | "barcode";
} = {}) {
  const [activeTab, setActiveTab] = React.useState<"generate" | "scan" | "barcode">(initialTab);
  const [payloadType, setPayloadType] = React.useState<QrPayloadType>("url");

  // Form states
  const [urlInput, setUrlInput] = React.useState("https://pictools.app");
  const [textInput, setTextInput] = React.useState("PicTools — Creative Imaging Suite");
  const [wifiData, setWifiData] = React.useState<WifiData>({
    ssid: "Office_WiFi",
    password: "",
    encryption: "WPA",
  });
  const [vcardData, setVcardData] = React.useState<VCardData>({
    firstName: "Alex",
    lastName: "Taylor",
    organization: "Design Studio",
    phone: "+1 555-0192",
    email: "alex@example.com",
    url: "https://example.com",
  });
  const [emailData, setEmailData] = React.useState<EmailData>({
    email: "hello@example.com",
    subject: "Inquiry",
    body: "Hello, I am interested in your work.",
  });
  const [smsData, setSmsData] = React.useState<SmsData>({
    phone: "+1 555-0192",
    message: "Hey! Scanning your QR code.",
  });

  // Styling state
  const [styling, setStyling] = React.useState<QrStylingOptions>(DEFAULT_QR_STYLING);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);

  // Scanner state
  const [scanFile, setScanFile] = React.useState<File | null>(null);
  const [scanResult, setScanResult] = React.useState<ScanQrResult | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  // Compute final payload string based on active type
  const computedPayload = React.useMemo(() => {
    switch (payloadType) {
      case "url":
        return urlInput.trim();
      case "wifi":
        return formatWifiPayload(wifiData);
      case "vcard":
        return formatVCardPayload(vcardData);
      case "email":
        return formatEmailPayload(emailData);
      case "sms":
        return formatSmsPayload(smsData);
      case "text":
      default:
        return textInput.trim();
    }
  }, [payloadType, urlInput, wifiData, vcardData, emailData, smsData, textInput]);

  // Redraw QR preview canvas
  React.useEffect(() => {
    if (activeTab !== "generate") return;
    let cancelled = false;

    generateQrCanvas(computedPayload, styling, 512).then((c) => {
      if (cancelled || !previewCanvasRef.current) return;
      const dest = previewCanvasRef.current;
      dest.width = c.width;
      dest.height = c.height;
      const ctx = dest.getContext("2d");
      if (ctx) ctx.drawImage(c, 0, 0);
    });

    return () => {
      cancelled = true;
    };
  }, [computedPayload, styling, activeTab]);

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label}!`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setStyling((prev) => ({ ...prev, logoImg: img, errorCorrection: "H" }));
      toast.success("Logo uploaded and embedded into QR code!");
    };
    img.src = url;
  };

  const handleDownloadSvg = async () => {
    try {
      const svg = await generateQrSvg(computedPayload, styling);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, `qrcode-${payloadType}-${Date.now()}.svg`);
      toast.success("Downloaded Scalable Vector QR Code (.SVG)!");
    } catch {
      toast.error("Failed to generate SVG");
    }
  };

  const handleDownloadPng = async (dim = 1024) => {
    try {
      const canvas = await generateQrCanvas(computedPayload, styling, dim);
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `qrcode-${dim}px-${Date.now()}.png`);
          toast.success(`Downloaded High-Res ${dim}px PNG QR Code!`);
        }
      }, "image/png");
    } catch {
      toast.error("Failed to render PNG");
    }
  };

  // Scanner handler
  const handleScanDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setScanFile(f);
    setIsScanning(true);
    setScanResult(null);

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const res = await decodeQrFromImage(img);
        if (res) {
          setScanResult(res);
          toast.success("QR code decoded successfully!");
        } else {
          toast.error("No valid QR code or barcode found in this image.");
        }
      } catch {
        toast.error("Error reading image data");
      } finally {
        setIsScanning(false);
      }
    };
    img.onerror = () => {
      setIsScanning(false);
      toast.error("Could not read uploaded image");
    };
    img.src = url;
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <QrCode className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                QR Code & Smart Barcode Studio
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Generate branded QR codes for Wi-Fi, vCard contacts, links and decode QR codes from photos.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border">
            <Button
              size="sm"
              variant={activeTab === "generate" ? "default" : "ghost"}
              onClick={() => setActiveTab("generate")}
              className="gap-1.5 text-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Generator
            </Button>
            <Button
              size="sm"
              variant={activeTab === "scan" ? "default" : "ghost"}
              onClick={() => setActiveTab("scan")}
              className="gap-1.5 text-xs"
            >
              <Scan className="w-3.5 h-3.5" />
              QR Scanner
            </Button>
            <Button
              size="sm"
              variant={activeTab === "barcode" ? "default" : "ghost"}
              onClick={() => setActiveTab("barcode")}
              className="gap-1.5 text-xs"
            >
              <Barcode className="w-3.5 h-3.5" />
              1D Product Barcode
            </Button>
          </div>
        </div>

        {/* MODE 1: GENERATOR */}
        {activeTab === "generate" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form & Customization */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Type Switcher */}
              <div className="bg-card border rounded-2xl p-4 shadow-sm">
                <Label className="text-xs font-semibold text-muted-foreground mb-2.5 block">
                  QR Content Type
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { id: "url", label: "Website", icon: Globe },
                    { id: "wifi", label: "Wi-Fi", icon: Wifi },
                    { id: "vcard", label: "Contact", icon: User },
                    { id: "email", label: "Email", icon: Mail },
                    { id: "sms", label: "SMS", icon: MessageSquare },
                    { id: "text", label: "Plain Text", icon: Code2 },
                  ].map(({ id, label, icon: Icon }) => (
                    <Button
                      key={id}
                      size="sm"
                      variant={payloadType === id ? "default" : "outline"}
                      className={`h-9 text-xs flex-col py-1 ${
                        payloadType === id ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""
                      }`}
                      onClick={() => setPayloadType(id as QrPayloadType)}
                    >
                      <Icon className="w-3.5 h-3.5 mb-0.5" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Payload Form Fields */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                {payloadType === "url" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Website URL</Label>
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com"
                      className="text-xs font-mono"
                    />
                  </div>
                )}

                {payloadType === "wifi" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Network Name (SSID)</Label>
                      <Input
                        value={wifiData.ssid}
                        onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                        placeholder="My_Home_WiFi"
                        className="text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Password</Label>
                        <Input
                          type="password"
                          value={wifiData.password || ""}
                          onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                          placeholder="Password"
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Security</Label>
                        <select
                          value={wifiData.encryption}
                          onChange={(e) => setWifiData({ ...wifiData, encryption: e.target.value as any })}
                          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                        >
                          <option value="WPA">WPA / WPA2 / WPA3</option>
                          <option value="WEP">WEP</option>
                          <option value="nopass">Open (No Password)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {payloadType === "vcard" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">First Name</Label>
                        <Input
                          value={vcardData.firstName}
                          onChange={(e) => setVcardData({ ...vcardData, firstName: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Last Name</Label>
                        <Input
                          value={vcardData.lastName}
                          onChange={(e) => setVcardData({ ...vcardData, lastName: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Phone</Label>
                        <Input
                          value={vcardData.phone || ""}
                          onChange={(e) => setVcardData({ ...vcardData, phone: e.target.value })}
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Email</Label>
                        <Input
                          value={vcardData.email || ""}
                          onChange={(e) => setVcardData({ ...vcardData, email: e.target.value })}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Organization / Company</Label>
                      <Input
                        value={vcardData.organization || ""}
                        onChange={(e) => setVcardData({ ...vcardData, organization: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {payloadType === "email" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Recipient Email</Label>
                      <Input
                        value={emailData.email}
                        onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Subject</Label>
                      <Input
                        value={emailData.subject || ""}
                        onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {payloadType === "sms" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Phone Number</Label>
                      <Input
                        value={smsData.phone}
                        onChange={(e) => setSmsData({ ...smsData, phone: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Pre-filled Message</Label>
                      <Input
                        value={smsData.message || ""}
                        onChange={(e) => setSmsData({ ...smsData, message: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {payloadType === "text" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Plain Text Content</Label>
                    <textarea
                      rows={3}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent p-2 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Styling & Logo Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Styling & Center Logo
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">QR Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={styling.fgColor}
                        onChange={(e) => setStyling({ ...styling, fgColor: e.target.value })}
                        className="w-8 h-9 rounded cursor-pointer border p-0.5 bg-transparent"
                      />
                      <span className="font-mono text-xs">{styling.fgColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={styling.bgColor === "transparent" ? "#ffffff" : styling.bgColor}
                        onChange={(e) => setStyling({ ...styling, bgColor: e.target.value })}
                        className="w-8 h-9 rounded cursor-pointer border p-0.5 bg-transparent"
                      />
                      <Button
                        size="sm"
                        variant={styling.bgColor === "transparent" ? "default" : "outline"}
                        className="h-9 text-xs px-2"
                        onClick={() =>
                          setStyling({
                            ...styling,
                            bgColor: styling.bgColor === "transparent" ? "#ffffff" : "transparent",
                          })
                        }
                      >
                        {styling.bgColor === "transparent" ? "Transparent" : "Opaque"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Center Logo Upload */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Embed Center Logo</Label>
                    {logoFile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-destructive"
                        onClick={() => {
                          setLogoFile(null);
                          setStyling((prev) => ({ ...prev, logoImg: null }));
                        }}
                      >
                        Remove Logo
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs gap-1.5"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {logoFile ? logoFile.name : "Choose PNG Logo"}
                    </Button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live QR Preview & Downloads */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center">
                <div className="p-4 rounded-2xl border bg-white shadow-md flex items-center justify-center mb-5">
                  <canvas ref={previewCanvasRef} className="max-w-[260px] w-full aspect-square" />
                </div>

                {/* Download Actions */}
                <div className="w-full space-y-2.5">
                  <Button
                    onClick={handleDownloadSvg}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Vector (.SVG)
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPng(1024)}
                      className="text-xs gap-1"
                    >
                      1024px PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPng(2048)}
                      className="text-xs gap-1"
                    >
                      2048px Print
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: SCANNER */}
        {activeTab === "scan" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Dropzone
              kind="image"
              onFiles={handleScanDrop}
            />

            {isScanning && (
              <div className="p-8 rounded-2xl border bg-card text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <span className="text-sm font-medium">Scanning image for QR code / barcode...</span>
              </div>
            )}

            {scanResult && (
              <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                      <Check className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-base">Decoded QR Code</h3>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono mt-0.5">
                        Type: {scanResult.type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Raw Decoded Box */}
                <div className="p-4 rounded-xl border bg-slate-950 font-mono text-xs text-slate-100 break-all select-all">
                  {scanResult.data}
                </div>

                {/* Contextual Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {scanResult.type === "url" && (
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                      onClick={() => window.open(scanResult.data, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Link
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleCopy(scanResult.data, "Decoded text", "scan-copy")}
                  >
                    {copiedKey === "scan-copy" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Text
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: 1D PRODUCT BARCODE */}
        {activeTab === "barcode" && (
          <div className="pt-2 animate-in fade-in-50">
            <BarcodeTool />
          </div>
        )}
      </div>
    </AuthGate>
  );
}
