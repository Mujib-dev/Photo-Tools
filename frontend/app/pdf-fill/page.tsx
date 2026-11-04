import type { Metadata } from "next";
import { PdfFillTool } from "./pdf-fill-tool";

export const metadata: Metadata = {
  title: "Interactive PDF Form 'Fill & Sign' Studio — PicTools",
  description:
    "Type text, stamp dates, checkmarks, crosses, and draw digital signatures onto PDF forms. 100% in-browser, private, and free.",
};

export default function PdfFillPage() {
  return <PdfFillTool />;
}
