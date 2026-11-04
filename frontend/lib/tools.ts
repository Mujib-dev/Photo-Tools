import {
  Activity,
  Aperture,
  Archive,
  AudioLines,
  Bandage,
  BarChart2,
  Briefcase,
  Camera,
  Compass,
  Crop,
  Download,
  Eraser,
  Expand,
  FastForward,
  Eye,
  EyeOff,
  FileCheck2,
  FileSearch,
  FileText,
  Film,
  Frame,
  GitCompare,
  GraduationCap,
  Globe,
  Home,
  Images,
  Languages,
  Layers,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Mic,
  Mic2,
  Monitor,
  Move,
  Music,
  Palette,
  QrCode,
  Receipt,
  Repeat,
  Scale,
  Scaling,
  ScanLine,
  ScanText,
  Scissors,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Smile,
  Sparkles,
  Stamp,
  Subtitles,
  Sun,
  UserCheck,
  Users,
  Video,
  Volume2,
  Wand2,
  Zap,
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
    label: "AI Tools",
    desc: "Neural generation, super-resolution & video synthesis",
    icon: Sparkles,
    items: [
      {
        href: "/ai-generator",
        label: "AI Creative Studio",
        title: "AI Text to Image & Video Generator",
        desc: "FLUX.1 text-to-image, photo animator & text-to-video",
        blurb:
          "Generate photorealistic 8K images with FLUX.1, animate still photos into 3D motion videos with camera kinematics, and synthesize full video clips directly from text prompts.",
        icon: Sparkles,
      },
      {
        href: "/upscale",
        label: "AI Upscale & Enhance",
        title: "AI Super-Resolution & Remini Face Restorer",
        desc: "2x, 4x, face restoration & detail enhancement",
        blurb:
          "Reconstruct lost details, restore facial features, sharpen blurry textures, and upscale to 2x/4x Ultra-HD with Remini reverse-engineered neural clarity.",
        icon: Sparkles,
      },
      {
        href: "/eraser",
        label: "AI Magic Eraser",
        title: "AI Generative Eraser & Inpainting Studio",
        desc: "Erase watermarks, tourists, objects & restore eyes",
        blurb:
          "Brush over sunglasses to reconstruct natural eyes, erase unwanted people, power lines, or watermarks with deep neural AI Generative Fill (Flux) or instant Content-Aware inpainting.",
        icon: Wand2,
      },
      {
        href: "/remove-bg",
        label: "AI Background Remover",
        title: "Background Remover",
        desc: "Cut out photos automatically",
        blurb:
          "Remove backgrounds automatically right in your browser with AI. Export as transparent PNG or download the mask.",
        icon: Scissors,
      },
      {
        href: "/headshot",
        label: "AI Headshot Studio",
        title: "AI Corporate Headshot & Wardrobe Studio",
        desc: "Turn casual selfies into executive portraits",
        blurb:
          "Transform casual smartphone snapshots into corporate headshots with executive backdrops, tailored business attire, and studio lighting.",
        icon: UserCheck,
      },
      {
        href: "/restore",
        label: "AI Restorer",
        title: "AI Vintage Scratch & Tear Restorer",
        desc: "Repair scratches, folds & aged photo tears",
        blurb:
          "Detect and heal physical scratches, paper tears, dust speckles, and fold creases on vintage family photos with neural fast marching boundary inpainting.",
        icon: Bandage,
      },
      {
        href: "/colorize",
        label: "AI Colorizer",
        title: "AI Historical Photo Colorizer",
        desc: "Bring black and white archival photos to life",
        blurb:
          "Restore historical black-and-white family portraits with realistic skin undertones, vibrant sky gradients, and authentic fabric saturation.",
        icon: Palette,
      },
      {
        href: "/relight",
        label: "AI Relighter",
        title: "AI 3D Relighter & Studio Gels",
        desc: "Add virtual studio lights and ambient color gels",
        blurb:
          "Place virtual 3D point lights, rim highlights, and ambient gels to reshape portrait illumination and add cinematic depth.",
        icon: Sun,
      },
      {
        href: "/uncrop",
        label: "AI Uncrop",
        title: "AI Canvas Expander & Generative Uncrop",
        desc: "Outpaint & expand photo canvas",
        blurb:
          "Expand photo canvas boundaries beyond original borders with generative texture synthesis, multi-layer edge blending, and social aspect ratio outpainting presets.",
        icon: Expand,
      },
      {
        href: "/product-studio",
        label: "Product Studio & Ad Creator",
        title: "AI Commercial Product Photography & Ad Creator Studio",
        desc: "Turn simple photos into commercial products & marketing ads",
        blurb:
          "Isolate products with 1-click cutout, place on Carrara marble, Amazon pure white, or custom AI scenes, and design high-converting commercial ads with sale badges, price tags, and CTA buttons.",
        icon: ShoppingBag,
      },
      {
        href: "/real-estate",
        label: "Real Estate & Virtual Staging",
        title: "AI Real Estate, Exterior & Virtual Staging Studio",
        desc: "Sky replacement, day-to-dusk twilight & room staging",
        blurb:
          "Convert property photos into sunny, golden-hour, or luxury twilight dusk MLS listings with sky replacement, lawn greening, window lighting glow, and interior architectural staging.",
        icon: Home,
      },
      {
        href: "/floorplan-stager",
        label: "Floor Plan Stager",
        title: "AI Floor Plan to 3D Interior Stager",
        desc: "2D blueprint to 3D photorealistic render",
        blurb:
          "Drop a 2D architectural blueprint, floor sketch, or empty room photo and generate a photorealistic 3D interior render (Japandi, Scandinavian, Modern Luxury).",
        icon: Home,
      },
      {
        href: "/ai-model-studio",
        label: "Fashion Model & Outfit Studio",
        title: "AI Fashion Model & Virtual Fitting Studio",
        desc: "Ghost mannequin to model, fabric drape & outfit styling",
        blurb:
          "Put flat clothing and ghost mannequins onto diverse demographic fashion models with realistic contact drop shadows, custom colorways, and coordinated styling pairings.",
        icon: ShoppingBag,
      },
    ],
  },
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
        href: "/carousel-maker",
        label: "Carousel & Grid Studio",
        title: "Panoramic Carousel & Social Grid Slicer",
        desc: "Instagram & LinkedIn connected carousels & 3x3 grids",
        blurb:
          "Design seamless continuous multi-slide carousels for Instagram, LinkedIn, and Twitter, or slice panoramas and 3x3 profile puzzle grids with instant ZIP export.",
        icon: Images,
      },
      {
        href: "/frame",
        label: "Borders & Text",
        title: "Borders, Frames & Captions",
        desc: "Frames, captions & text overlays",
        blurb:
          "Add clean borders, rounded corners, captions, and text styling at any position with custom typography.",
        icon: Frame,
      },
      {
        href: "/exif",
        label: "Metadata & EXIF",
        title: "Metadata & EXIF Inspector",
        desc: "Inspect, edit and strip EXIF",
        blurb:
          "See camera settings, timestamps, GPS locations, and strip sensitive EXIF metadata before sharing.",
        icon: FileSearch,
      },
      {
        href: "/lut-studio",
        label: "Film LUT & Color Match",
        title: "AI Film LUT, Color Match & Grading Studio",
        desc: "Kodak Portra, movie palette transfer & .cube LUTs",
        blurb:
          "Apply cinematic 3D Film LUTs or transfer color palettes from any reference movie still. Export high-res photos and standard .cube 3D LUT files.",
        icon: Film,
      },
      {
        href: "/thumbnail-studio",
        label: "Thumbnail Studio",
        title: "YouTube Thumbnail Studio & Feed CTR Simulator",
        desc: "Sticker borders, typography & CTR score",
        blurb:
          "Craft high-clickability thumbnails for YouTube, Shorts, and Reels with sticker borders, bold typography, and a feed simulator.",
        icon: Sparkles,
      },
      {
        href: "/meme-generator",
        label: "Meme Studio",
        title: "AI Animated GIF & Viral Meme Studio",
        desc: "AI punchlines & viral social cards",
        blurb:
          "Create viral memes with AI-suggested punchlines, classic Impact fonts, or modern Twitter social card styling 100% in-browser.",
        icon: Smile,
      },
      {
        href: "/mockup-studio",
        label: "3D Mockups",
        title: "3D Device Mockup Studio",
        desc: "iPhone 16, MacBook & browser frames",
        blurb:
          "Wrap screenshots into realistic 3D iPhone 16 Pro, MacBook Pro, and macOS browser frames with dynamic shadows.",
        icon: Smartphone,
      },
      {
        href: "/favicon-generator",
        label: "Favicon Studio",
        title: "Favicon & Complete App Icon Generator",
        desc: "ICO, Apple touch & PWA manifest package",
        blurb:
          "Generate full favicon packages from 1 logo: favicon.ico, Apple Touch Icon (180x180), Android 192/512px, and site.webmanifest in a 1-click ZIP.",
        icon: Zap,
      },
      {
        href: "/stat-card",
        label: "Social Quote Cards",
        title: "Social Quote & Stat Card Maker",
        desc: "Quotes, metrics & verified social cards",
        blurb:
          "Turn quotes, metrics, testimonials, and insights into high-engagement social media cards formatted for LinkedIn, Twitter, and Instagram.",
        icon: MessageSquare,
      },
      {
        href: "/app-store-builder",
        label: "App Store Packager",
        title: "App Store & Google Play Screenshot Packager",
        desc: "Official iOS & Android store screenshots",
        blurb:
          "Generate pixel-perfect Apple App Store (6.7\", 6.5\", iPad) and Google Play promotional screenshots with 3D device bezels, connected panoramic gradients, and automated ZIP export.",
        icon: Smartphone,
      },
      {
        href: "/geotag-inspector",
        label: "GPS Trip Map",
        title: "Multi-Photo Trip Route & GPS Geotag Map Studio",
        desc: "Interactive travel routes, altitude & privacy shield",
        blurb:
          "Plot multi-photo travel routes, inspect EXIF GPS coordinates, generate AI travelogue stories, and strip sensitive location tags before sharing.",
        icon: MapPin,
      },
      {
        href: "/bio-link",
        label: "Link-in-Bio & QR",
        title: "Dynamic Link-in-Bio & Smart QR Code Studio",
        desc: "Mobile micro-sites, custom QR & AI bio copy",
        blurb:
          "Design mobile micro-site link pages with Apple glassmorphism and obsidian themes, generate custom vector QR codes, and export standalone single-file HTML sites.",
        icon: Globe,
      },
      {
        href: "/palette",
        label: "Color Palette",
        title: "Color Palette & Gradient Studio",
        desc: "Extract harmonies & CSS gradients",
        blurb:
          "Extract dominant swatches, inspect WCAG contrast scores, explore color harmonies, and synthesize CSS gradients from any photo.",
        icon: Palette,
      },
      {
        href: "/bokeh",
        label: "Portrait Bokeh",
        title: "AI Portrait Bokeh & Depth Studio",
        desc: "DSLR depth-of-field & blur",
        blurb:
          "Turn photos into DSLR portraits: tap-to-focus depth of field, specular highlight bloom, tilt-shift miniature optics, and depth maps.",
        icon: Aperture,
      },
      {
        href: "/parallax-animator",
        label: "3D Parallax",
        title: "3D Parallax & Living Photo Animator",
        desc: "Turn 2D photos into 3D cinemagraphs",
        blurb:
          "Turn flat 2D still images into subtle 3D parallax looping cinemagraphs, zoom-bursts, or camera orbit MP4s/GIFs with depth estimation.",
        icon: Move,
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
        desc: "Convert, merge, split, edit & sign",
        blurb:
          "Build a PDF from images, merge, split, reorder and sign documents with digital signatures, text, drawings and metadata.",
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
      {
        href: "/ocr",
        label: "AI OCR",
        title: "AI Document & Image OCR",
        desc: "Extract text from images & PDFs",
        blurb:
          "Scan documents, receipts and images to extract editable text with word bounding boxes, language recognition, and Word (.docx) export.",
        icon: ScanText,
      },
      {
        href: "/qrcode",
        label: "QR & Barcode Studio",
        title: "QR Code, Barcode & Label Studio",
        desc: "Vector QR, Amazon FNSKU & thermal labels",
        blurb:
          "Generate branded vector QR codes, Amazon FNSKU / EAN-13 barcodes, Avery 30-up sheets, and thermal printer labels with real-time scanner decoding.",
        icon: QrCode,
      },
      {
        href: "/passport",
        label: "Passport Photo",
        title: "Biometric Passport & Visa Photo Studio",
        desc: "50+ countries, biometric guides & 4x6 print sheets",
        blurb:
          "Create official passport, visa and ID photos conforming to biometric regulations worldwide with eye/head guidelines, auto background removal and 4x6 inch print sheets.",
        icon: UserCheck,
      },
      {
        href: "/receipt-parser",
        label: "Receipt Parser",
        title: "AI Receipt & Invoice Financial Parser",
        desc: "Extract vendor, date, line items & tax",
        blurb:
          "Scan restaurant receipts, retail bills, and B2B invoices. Automatically extract vendor, date, invoice #, subtotal, tax, and itemized rows into Excel, CSV, or structured JSON.",
        icon: Receipt,
      },
      {
        href: "/invoice-generator",
        label: "Invoice Builder",
        title: "Smart In-Browser Invoice & Receipt Builder",
        desc: "Custom logo, payment QR codes, tax & vector PDF export",
        blurb:
          "Create, customize, and print client invoices with company logo branding, automatic tax calculations, UPI/PayPal/SEPA payment QR codes, and vector PDF export.",
        icon: FileText,
      },
      {
        href: "/esign-documents",
        label: "E-Sign Suite",
        title: "Legally-Binding E-Sign & Agreement Suite",
        desc: "Digital ink, SHA-256 audit certificate & ESIGN compliance",
        blurb:
          "Sign contracts, NDAs, and agreements with digital ink signatures and generate tamper-evident SHA-256 Audit Trail Certificates conforming to ESIGN and eIDAS.",
        icon: ShieldCheck,
      },
      {
        href: "/pdf-security",
        label: "PDF Security",
        title: "PDF Security & Permissions Manager",
        desc: "AES-256 password lock & unlock",
        blurb:
          "Lock PDF documents with military-grade AES-256 passwords, control print and copy permissions, or permanently decrypt and unlock password-protected files.",
        icon: ShieldCheck,
      },
      {
        href: "/resume-optimizer",
        label: "AI Resume & ATS",
        title: "AI Resume & ATS Score Optimizer",
        desc: "Pass ATS filters, match keywords & rewrite bullets",
        blurb:
          "Scan your resume against any job description with enterprise ATS simulation. Identify missing keywords, get Google X-Y-Z formula bullet point rewrites, and boost interview callbacks.",
        icon: FileCheck2,
      },
      {
        href: "/legal-analyzer",
        label: "Legal Contract Analyzer",
        title: "Smart Contract & Legal Agreement Analyzer",
        desc: "Spot uncapped liability, non-competes & traps",
        blurb:
          "AI legal agreement and contract risk analyzer. Automatically detect hidden gotchas, uncapped liabilities, non-competes, evergreen auto-renewals, and unfair clauses before signing.",
        icon: Scale,
      },
      {
        href: "/redact",
        label: "Privacy & Document Redactor",
        title: "AI Privacy Redactor & Document PII Sanitizer",
        desc: "Blur & blackout faces, plates, cards & confidential PII",
        blurb:
          "Automatically detect and irreversibly blackout or blur faces, license plates, credit cards, SSNs, and confidential document text with compliance stamps.",
        icon: Shield,
      },
      {
        href: "/translator",
        label: "Document Translator",
        title: "AI Document & PDF Language Translator",
        desc: "Side-by-side translation into 30+ languages",
        blurb:
          "Extract and translate PDF, Word (.docx) and text documents into 30+ languages side-by-side with paragraph alignment and instant Word export.",
        icon: Languages,
      },
      {
        href: "/document-diff",
        label: "Document Compare",
        title: "Smart Document Compare & Contract Diff Studio",
        desc: "Spot clause changes, pricing edits & deleted text",
        blurb:
          "Compare two versions of PDF, Word, or contract agreements side-by-side with automatic risk alerts for altered payment terms, liability changes, and deadlines.",
        icon: GitCompare,
      },
      {
        href: "/flashcards",
        label: "AI Flashcards",
        title: "AI Flashcard & Study Quiz Generator",
        desc: "Auto-extract Q&A from notes & PDFs",
        blurb:
          "Drop PDF lecture notes or textbook chapters to generate interactive flipping Q&A study flashcards and printable revision sheets.",
        icon: GraduationCap,
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
        desc: "Compress, trim, GIF, audio & frames",
        blurb:
          "Compress MP4, MOV, WebM and MKV videos to a target size or quality, trim and speed them up — or export an animated GIF, a still thumbnail, the audio track or a ZIP of frames.",
        icon: Film,
      },
      {
        href: "/video-bg-remover",
        label: "Video BG Remover",
        title: "AI Video Background Remover & Auto-Rotoscoping",
        desc: "Remove video backgrounds without green screen",
        blurb:
          "Upload any MP4, MOV or WebM video and automatically isolate human subjects with alpha transparency or studio executive backdrops.",
        icon: Film,
      },
      {
        href: "/video-enhance",
        label: "AI Video Enhancer",
        title: "AI Video Enhancer & Remini Face Clarity",
        desc: "Enhance blurry videos, unblur faces, upscale to HD",
        blurb:
          "Remini-grade facial feature reconstruction, eye and teeth micro-sharpening, contrast adaptive super-resolution, and night/deblur revival for videos.",
        icon: Sparkles,
      },
      {
        href: "/viral-clips",
        label: "Viral Video Clipper",
        title: "Viral Short-Form Video Clipper & Submagic Subtitles",
        desc: "9:16 vertical reframe & karaoke subtitles",
        blurb:
          "Re-frame widescreen videos into 9:16 vertical shorts with blurred background letterboxing, animated karaoke subtitles, and hook headlines.",
        icon: Film,
      },
      {
        href: "/url-download",
        label: "Video & URL Downloader",
        title: "Video & URL Downloader",
        desc: "Save YouTube, streaming & media links",
        blurb:
          "Download video and audio from YouTube, Vimeo, TikTok, SoundCloud, public HLS (.m3u8) streams or direct files. Save in original quality, 4K, 1080p, 720p or extract MP3 audio.",
        icon: Download,
      },
      {
        href: "/subtitles",
        label: "Auto Subtitles",
        title: "Auto Video Subtitle & Animated Caption Studio",
        desc: "TikTok, Reels & Shorts burned captions",
        blurb:
          "Generate, edit, and burn viral TikTok/Reels captions onto videos with synchronized playback, custom fonts, outline styling, and 1-click .SRT and .VTT export.",
        icon: Subtitles,
      },
      {
        href: "/screen-recorder",
        label: "Screen & Webcam Studio",
        title: "Studio Screen & Webcam Recorder + Teleprompter",
        desc: "Screen record with circular PiP & teleprompter",
        blurb:
          "Record high-resolution screen presentations with circular webcam PiP, microphone mixing, and an auto-scrolling teleprompter script reader 100% in-browser.",
        icon: Monitor,
      },
      {
        href: "/audiogram-maker",
        label: "Podcast Audiograms",
        title: "Viral Podcast Audiogram & Waveform Video Studio",
        desc: "Dancing soundwaves, AI hook finder & video export",
        blurb:
          "Convert podcast clips and voice notes into viral dancing waveform audiograms for TikTok, Reels, and Shorts with AI climax hook detection and in-browser rendering.",
        icon: Video,
      },
      {
        href: "/motion-studio",
        label: "Speed Ramp Studio",
        title: "Cinematic Video Speed Ramp & Motion Studio",
        desc: "Bullet-time, slow-mo drops & AI climax detect",
        blurb:
          "Create Hollywood bullet-time speed ramps, dramatic slow-mo drops, and boomerang ping-pong loops with AI action climax detection 100% in-browser.",
        icon: FastForward,
      },
    ],
  },
  {
    label: "Audio",
    desc: "Convert audio, speak text and transcribe recordings",
    icon: AudioLines,
    items: [
      {
        href: "/stem-separator",
        label: "AI Vocal Remover",
        title: "AI Vocal Remover & Karaoke Stem Separator",
        desc: "Isolate vocals & instrumental karaoke stems",
        blurb:
          "Isolate crystal-clear vocals (acapella) and backing tracks (karaoke) with real-time interactive dual-track live faders, solo/mute auditioning, and studio-grade MP3/WAV export.",
        icon: Mic2,
      },
      {
        href: "/voice-changer",
        label: "AI Voice Changer",
        title: "AI Voice Changer & Character Morpher",
        desc: "Man to girl, baby, deep voice & robot",
        blurb:
          "Transform voice recordings and video clips into different characters: Man to Girl, Woman to Deep Man, Baby & Kid, Robot, Monster, Chipmunk, Helium, Radio & Cathedral Reverb.",
        icon: Wand2,
      },
      {
        href: "/voice-enhancer",
        label: "Voice Enhancer & Denoise",
        title: "AI Voice Isolator, Enhancer & Noise Reducer",
        desc: "Isolate vocals, remove AC/fan noise & studio EQ",
        blurb:
          "Isolate speech, eliminate background fan noise, air conditioner hum, traffic rumble, and apply broadcast dynamics compression and presence EQ 100% in-browser.",
        icon: Mic2,
      },
      {
        href: "/audio",
        label: "Audio Converter & Extractor",
        title: "Audio Studio, Converter & Video Extractor",
        desc: "Convert formats & extract audio from videos",
        blurb:
          "Convert audio files across MP3, WAV, AAC, FLAC, M4A, OGG, and extract pristine audio tracks directly from video clips with custom bitrates and timeline trimming.",
        icon: Music,
      },
      {
        href: "/bpm-detector",
        label: "BPM & Key Detector",
        title: "AI Audio BPM, Musical Key & Tempo Detector",
        desc: "Detect BPM, Camelot Key & tap tempo",
        blurb:
          "Automatically detect song BPM, musical key (Camelot Wheel), and harmonic mixing compatibility using spectral transient analysis and an interactive tap-tempo metronome.",
        icon: Activity,
      },
      {
        href: "/text-to-speech",
        label: "Text to Speech",
        title: "Text to Speech",
        desc: "Turn text into spoken audio",
        blurb:
          "Convert scripts, notes and articles into natural speech with the Windows voices installed on this PC. Pick a voice, tune the rate and volume, then download MP3 or WAV.",
        icon: Volume2,
      },
      {
        href: "/speech-to-text",
        label: "Speech to Text",
        title: "Speech to Text",
        desc: "Transcribe audio and video",
        blurb:
          "Upload a recording or capture your microphone and turn it into editable text with the Windows speech recognizer. Copy the transcript or save it as a .txt file.",
        icon: Mic,
      },
      {
        href: "/silence-cutter",
        label: "Silence Cutter",
        title: "Automatic Audio Silence & Dead Air Cutter",
        desc: "Snip awkward pauses & room dead air",
        blurb:
          "Automatically detect awkward pauses, room silence, and dead air in podcast and voice recordings. Snip them out smoothly with micro-crossfades.",
        icon: Scissors,
      },
    ],
  },
  {
    label: "Effects & Design",
    desc: "Cut out, brand, mockups and visual utilities",
    icon: Sparkles,
    items: [
      {
        href: "/watermark",
        label: "Watermark",
        title: "Photo Watermark",
        desc: "Stamp text across images",
        blurb:
          "Protect and brand your images — place a text watermark once or tile it across the whole photo.",
        icon: Stamp,
      },
      {
        href: "/batch",
        label: "Batch Studio",
        title: "Batch Watermark & Bulk Renamer",
        desc: "Bulk watermark, rename & zip",
        blurb:
          "Batch process dozens of photos: stamp text or logo watermarks, rename files with dynamic templates, resize, and download all in a ZIP.",
        icon: Layers,
      },
      {
        href: "/steganography",
        label: "Steganography",
        title: "Invisible Image Steganography & Anti-Theft Studio",
        desc: "Hide secret messages & ownership proof in pixels",
        blurb:
          "Hide secret text, copyright signatures, or private keys invisibly inside image pixels (LSB) and decode hidden messages 100% in-browser.",
        icon: EyeOff,
      },
      {
        href: "/glass-generator",
        label: "Glass & Shadows",
        title: "CSS Box Shadow, Mesh Gradient & 3D Glass Studio",
        desc: "VisionOS glass, multi-layer shadows & mesh gradients",
        blurb:
          "Design Apple VisionOS frosted glassmorphism, Josh Comeau harmonic diffuse shadows, and vibrant mesh gradients with instant 1-click Tailwind and CSS code export.",
        icon: Layers,
      },
      {
        href: "/chart-maker",
        label: "Charts & Infographics",
        title: "AI Chart & Data Infographic Studio",
        desc: "Linear-style charts, metrics & AI data prompt",
        blurb:
          "Design publication-ready Bar, Donut, Line, and Area vector charts, metrics cards, and racing comparison bars with instant 4K PNG export.",
        icon: BarChart2,
      },
      {
        href: "/merch-studio",
        label: "Merch & Apparel",
        title: "Print-on-Demand & Merch Mockup Studio",
        desc: "3D apparel mockups & AI Etsy/Shopify listing generator",
        blurb:
          "Generate realistic apparel mockups (T-shirts, hoodies, totes, mugs, caps) with fabric fold displacement, custom textile colors, and AI E-Commerce listing generator for Etsy & Shopify.",
        icon: ShoppingBag,
      },
      {
        href: "/virtual-tour",
        label: "360° Virtual Tour",
        title: "360° Virtual Tour & Panoramas Viewer Studio",
        desc: "Multi-room spherical tour & AI room highlights",
        blurb:
          "Build interactive multi-room 360° virtual tours with equirectangular spherical views, clickable teleport hotspots, AI room feature analysis, and standalone HTML export.",
        icon: Compass,
      },
      {
        href: "/vectorize",
        label: "SVG Vectorizer",
        title: "Bitmap to SVG Vectorizer & Tracer",
        desc: "Convert raster images to vectors",
        blurb:
          "Trace logos, icons, signatures, and sketches into scalable SVG paths with color clustering and curve smoothing.",
        icon: Zap,
      },
      {
        href: "/accessibility",
        label: "Accessibility Simulator",
        title: "AI Color Blindness & WCAG Accessibility Simulator",
        desc: "Protanopia, Deuteranopia & WCAG 2.2",
        blurb:
          "Simulate Deuteranopia, Protanopia, Tritanopia, and Achromatopsia on UI designs, graphics, and photos with instant WCAG 2.2 contrast checking.",
        icon: Eye,
      },
    ],
  },
];

export const TOOLS: ToolItem[] = Array.from(
  new Map(TOOL_GROUPS.flatMap((group) => group.items).map((item) => [item.href, item])).values()
);

export function getTool(href: string): ToolItem | undefined {
  return TOOLS.find((tool) => tool.href === href);
}
