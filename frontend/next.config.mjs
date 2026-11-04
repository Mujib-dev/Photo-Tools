import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin output tracing to the monorepo root so Next.js does not misinfer the
  // workspace root when multiple package-lock.json files exist.
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ],
  },
  async redirects() {
    return [
      { source: "/watermark-remover", destination: "/eraser", permanent: false },
      { source: "/barcode", destination: "/qrcode", permanent: false },
      { source: "/label-printer", destination: "/qrcode", permanent: false },
      { source: "/chart-maker", destination: "/infographic-maker", permanent: false },
      { source: "/virtual-staging", destination: "/real-estate", permanent: false },
      { source: "/extract-audio", destination: "/audio", permanent: false },
      { source: "/noise-reducer", destination: "/voice-enhancer", permanent: false },
      { source: "/document-redactor", destination: "/redact", permanent: false },
      { source: "/color-transfer", destination: "/lut-studio", permanent: false },
      { source: "/splitter", destination: "/carousel-maker", permanent: false },
      { source: "/ecommerce-batch", destination: "/product-studio", permanent: false },
      { source: "/outfit-studio", destination: "/ai-model-studio", permanent: false },
      { source: "/face-swap", destination: "/headshot", permanent: false },
      { source: "/enhance", destination: "/upscale", permanent: false },
      { source: "/pdf-fill", destination: "/pdf", permanent: false },
    ];
  },
};

export default nextConfig;
