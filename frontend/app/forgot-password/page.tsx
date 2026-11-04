import type { Metadata } from "next";
import { Suspense } from "react";

import { ForgotPasswordPage } from "@/components/auth-pages";

export const metadata: Metadata = {
  title: "Reset Password — PicTools",
  description: "Reset your PicTools password by email, SMS or WhatsApp.",
};

export default function ForgotPasswordRoute() {
  return (
    <Suspense>
      <ForgotPasswordPage />
    </Suspense>
  );
}
