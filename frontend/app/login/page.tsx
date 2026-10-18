import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginPage } from "@/components/auth-pages";

export const metadata: Metadata = {
  title: "Log In · PicTools",
  description: "Log in to PicTools to resize and convert your images.",
};

export default function LoginRoute() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
