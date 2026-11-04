import type { Metadata } from "next";
import { ProductStudioTool } from "./product-studio-tool";

export const metadata: Metadata = {
  title: "AI Commercial Product Studio & Ad Creator — LynkZone PicTools",
  description:
    "Transform casual product photos into high-converting commercial e-commerce shots with Amazon pure white compliance, Carrara marble slabs, realistic contact shadows, luxury pedestals, and ready-to-run marketing ads by LynkZone.",
};

export default function ProductStudioPage() {
  return <ProductStudioTool />;
}
