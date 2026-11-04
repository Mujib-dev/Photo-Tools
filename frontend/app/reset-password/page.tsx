import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordPage } from "@/components/auth-pages";

export const metadata: Metadata = {
  title: "Choose a New Password — PicTools",
  description: "Set a new password for your PicTools account.",
};

export default function ResetPasswordRoute() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
