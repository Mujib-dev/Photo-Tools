import type { Metadata } from "next";
import { AccessibilityTool } from "./accessibility-tool";

export const metadata: Metadata = {
  title: "AI Color Blindness & WCAG Accessibility Simulator — PicTools",
  description:
    "Simulate Deuteranopia, Protanopia, Tritanopia, and Achromatopsia on UI designs, screenshots, and marketing graphics with instant WCAG 2.2 contrast checking.",
};

export default function AccessibilityPage() {
  return <AccessibilityTool />;
}
