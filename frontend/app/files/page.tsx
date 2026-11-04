import type { Metadata } from "next";

import { FilesPage } from "./files-page";

export const metadata: Metadata = {
  title: "My Files",
  description: "Your recent processed files, ready to download again.",
};

export default function Page() {
  return <FilesPage />;
}
