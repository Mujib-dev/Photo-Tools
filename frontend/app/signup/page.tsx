import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupPage } from "@/components/auth-pages";

export const metadata: Metadata = {
  title: "Create Account · PicTools",
  description: "Create a free PicTools account to resize and convert your images.",
};

export default function SignupRoute() {
  return (
    <Suspense>
      <SignupPage />
    </Suspense>
  );
}
