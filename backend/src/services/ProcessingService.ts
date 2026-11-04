import type {
  ResizeSettings,
  ConvertSettings,
  EnhanceSettings,
  ScanSettings,
  PdfSettings,
  RemoveBgSettings,
  CompressSettings,
  WatermarkSettings,
  VideoSettings,
  UrlDownloadSettings,
  AudioSettings,
  OcrSettings,
} from "../validation/validators.js";

/**
 * Abstraction over the actual image-processing engine. Today every operation is
 * delegated to the existing Windows executables (ExeResizeService /
 * ExeConvertService / ExeEnhancerService / ExeScannerService). The layer is
 * designed so a native implementation (e.g. Sharp) can be dropped in later
 * without touching the job system or the API.
 */
export type ProcessingSettings =
  | ResizeSettings
  | ConvertSettings
  | EnhanceSettings
  | ScanSettings
  | PdfSettings
  | RemoveBgSettings
  | CompressSettings
  | WatermarkSettings
  | VideoSettings
  | UrlDownloadSettings
  | AudioSettings
  | OcrSettings;

export interface ProcessingRequest {
  inputPath: string;
  outputDir: string;
  outputBaseName: string;
  settings: ProcessingSettings;
  /** Optional progress callback (0..1) — only some engines report progress. */
  onProgress?: (fraction: number) => void;
}

export interface ProcessingResult {
  outputPath: string;
}

export interface ProcessingService {
  readonly operation:
    | "resize"
    | "convert"
    | "enhance"
    | "scan"
    | "pdf"
    | "removebg"
    | "compress"
    | "watermark"
    | "video"
    | "fetch"
    | "audio"
    | "ocr";
  process(request: ProcessingRequest): Promise<ProcessingResult>;
}
