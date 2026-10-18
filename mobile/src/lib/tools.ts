import type { ToolSettings } from "./types";

/**
 * Declarative description of the single-image tools.
 *
 * The six tools share one screen (`app/tools/[id].tsx`) that reads this
 * registry to render the right controls, mirroring how the web frontend
 * delegates every tool to a single generic `Processor` component.
 */

export type ToolId =
  | "resize"
  | "convert"
  | "enhance"
  | "removebg"
  | "compress"
  | "watermark";

export interface ToolDefinition {
  id: ToolId;
  /** Backend route. */
  endpoint: string;
  title: string;
  description: string;
  /** Glyph used in the tool list; avoids an icon font dependency. */
  glyph: string;
  /** File types the picker should offer. */
  accepts: "image";
  defaults: () => ToolSettings;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "resize",
    endpoint: "/api/resize",
    title: "Resize",
    description: "Resize by physical size with DPI, or by pixels.",
    glyph: "⤢",
    accepts: "image",
    defaults: () => ({ mode: "cm", width: 3.5, height: 4.5, dpi: 300, format: "jpg" }),
  },
  {
    id: "convert",
    endpoint: "/api/convert",
    title: "Convert to ICO",
    description: "Build a multi-size .ico icon from one image.",
    glyph: "◈",
    accepts: "image",
    defaults: () => ({ sizes: [16, 32, 48, 64, 128, 256], format: "ico" }),
  },
  {
    id: "enhance",
    endpoint: "/api/enhance",
    title: "Enhance",
    description: "Auto or manual sharpness, contrast and denoise.",
    glyph: "✦",
    accepts: "image",
    defaults: () => ({
      auto: true,
      sharpness: 1.3,
      contrast: 1.12,
      saturation: 1.1,
      brightness: 1.03,
      denoise: 1,
      scale: 1,
      format: "jpg",
    }),
  },
  {
    id: "removebg",
    endpoint: "/api/remove-bg",
    title: "Remove background",
    description: "Cut out the subject and flatten onto a new background.",
    glyph: "◐",
    accepts: "image",
    defaults: () => ({ background: "transparent", format: "png" }),
  },
  {
    id: "compress",
    endpoint: "/api/compress",
    title: "Compress",
    description: "Shrink a photo down to a target file size.",
    glyph: "⇩",
    accepts: "image",
    defaults: () => ({ targetKb: 200, format: "keep" }),
  },
  {
    id: "watermark",
    endpoint: "/api/watermark",
    title: "Watermark",
    description: "Stamp text across your image.",
    glyph: "©",
    accepts: "image",
    defaults: () => ({
      text: "© PicTools",
      position: "bottom-right",
      opacity: 40,
      size: 8,
      color: "white",
      format: "jpg",
    }),
  },
];

export const TOOL_IDS = TOOLS.map((t) => t.id);

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
