import type { Metadata } from "next";
import { AiModelStudioTool } from "./ai-model-studio-tool";

export const metadata: Metadata = {
  title: "AI E-Commerce Fashion Model & Product Studio — PicTools",
  description:
    "Render ghost mannequins and apparel onto diverse demographic fashion models with realistic contact shadows and Amazon FBA compliance.",
};

export default function AiModelStudioPage() {
  return <AiModelStudioTool />;
}
