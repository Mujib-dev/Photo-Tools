import {
  Archive,
  Camera,
  Crop,
  Eraser,
  FileSearch,
  FileText,
  Film,
  Frame,
  Images,
  LayoutGrid,
  Repeat,
  Scaling,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  type LucideIcon,
} from "lucide-react";

export type ToolItem = {
  href: string;
  /** Short label for navigation. */
  label: string;
  /** Long marketing title for the home page cards. */
  title: string;
  /** One-line summary for menus and the auth gate. */
  desc: string;
  /** Full description for the home page cards. */
  blurb: string;
  icon: LucideIcon;
};

export type ToolGroup = {
  label: string;
  /** Short one-line summary of the group for the menu. */
  desc: string;
  /** Representative icon for the group. */
  icon: LucideIcon;
  items: ToolItem[];
};

export const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Images",
    desc: "Edit, resize and convert photos",
    icon: Images,
    items: [
      {
        href: "/crop",
        label: "Crop & Rotate",
        title: "Crop & Rotate",
        desc: "Straighten, flip and reframe",
        blurb:
          "Rotate and flip photos, then drag a crop box with 1:1, 4:3 and 16:9 presets — exported as PNG, JPG or WEBP right in your browser.",
        icon: Crop,
      },
      {
        href: "/resize",
        label: "Resize",
        title: "Photo Resizer",
        desc: "Physical size or pixels",
        blurb:
          "Instantly resize your images for social media, web, or print without losing quality. Precision controls for exact dimensions.",
        icon: Scaling,
      },
      {
        href: "/convert",
        label: "Convert",
        title: "Photo Converter",
        desc: "Build multi-size .ico icons",
        blurb:
          "Convert your images to JPG, PNG, WEBP, TIFF, BMP, GIF or crisp multi-size .ico icons.",
        icon: Repeat,
      },
      {
        href: "/compress",
        label: "Compress",
        title: "Image Compressor",
        desc: "Shrink the file size",
        blurb:
          "Hit an exact size limit for form uploads — set a target in KB and get the highest quality that fits.",
        icon: Archive,
      },
      {
        href: "/enhance",
        label: "Enhance",
        title: "Photo Enhancer",
        desc: "Upscale and sharpen",
        blurb:
          "Make your photos pop with one-click auto-enhance or fine manual control over sharpness, contrast, color and denoise.",
        icon: Sparkles,
      },
      {
        href: "/adjust",
        label: "Adjust",
        title: "Adjust & Filters",
        desc: "Tune light, color and filters",
        blurb:
          "Fine-tune brightness, contrast, saturation, warmth, hue and vignette — or start from a one-tap filter. Live preview with batch export to PNG, JPG or WEBP.",
        icon: SlidersHorizontal,
      },
      {
        href: "/collage",
        label: "Collage",
        title: "Collage & Combine",
        desc: "Merge photos into one",
        blurb:
          "Combine several photos into a grid, a row or a stacked strip — adjust spacing, corner rounding and background, then export a single image.",
        icon: LayoutGrid,
      },
      {
        href: "/exif",
        label: "Metadata",
        title: "Metadata & EXIF",
        desc: "Inspect and strip EXIF",
        blurb:
          "See the camera, settings, timestamps and GPS your photos carry — then remove it in one click. JPEG and PNG are cleaned losslessly.",
        icon: FileSearch,
      },
      {
        href: "/frame",
        label: "Borders",
        title: "Borders & Text",
        desc: "Frames, captions, watermarks",
        blurb:
          "Add a clean border, rounded corners and a caption or watermark at any of nine positions — with background bars, custom fonts and colors.",
        icon: Frame,
      },
    ],
  },
  {
    label: "Documents",
    desc: "PDFs, scans and screenshots",
    icon: FileText,
    items: [
      {
        href: "/pdf",
        label: "PDF Tools",
        title: "PDF Toolkit",
        desc: "Convert, merge, split, edit",
        blurb:
          "Build a PDF from images, then merge, split, reorder and edit pages with text, drawings and metadata.",
        icon: FileText,
      },
      {
        href: "/scan",
        label: "Scan",
        title: "Document Scanner",
        desc: "Flatten photos into a PDF",
        blurb:
          "Turn photos of documents into clean, straight scans — automatic edge detection, perspective correction and PDF export.",
        icon: ScanLine,
      },
      {
        href: "/screenshot",
        label: "Screenshot",
        title: "Screenshot Studio",
        desc: "Capture screen to PDF",
        blurb:
          "Grab your current screen, auto-capture a run of pages or crop a custom region — then combine the shots into one PDF.",
        icon: Camera,
      },
    ],
  },
  {
    label: "Video",
    desc: "Compress, trim and export clips",
    icon: Film,
    items: [
      {
        href: "/video",
        label: "Video Studio",
        title: "Video Studio",
        desc: "Compress, trim, GIF, audio, frames",
        blurb:
          "Compress MP4, MOV, WebM and MKV videos to a target size or quality, trim and speed them up — or export an animated GIF, a still thumbnail, the audio track or a ZIP of frames.",
        icon: Film,
      },
    ],
  },
  {
    label: "Effects",
    desc: "Cut out and watermark photos",
    icon: Sparkles,
    items: [
      {
        href: "/remove-bg",
        label: "Remove BG",
        title: "AI Background Remover",
        desc: "Cut out the background",
        blurb:
          "Cut the subject out of any photo with a neural network — transparent PNG, white or black background.",
        icon: Eraser,
      },
      {
        href: "/watermark",
        label: "Watermark",
        title: "Photo Watermark",
        desc: "Stamp text across images",
        blurb:
          "Protect and brand your images — place a text watermark once or tile it across the whole photo.",
        icon: Stamp,
      },
    ],
  },
];

export const TOOLS: ToolItem[] = TOOL_GROUPS.flatMap((group) => group.items);

export function getTool(href: string): ToolItem | undefined {
  return TOOLS.find((tool) => tool.href === href);
}
