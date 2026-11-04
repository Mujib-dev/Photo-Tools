import type { Metadata } from "next";
import { Suspense } from "react";

import { ForgotEmailPage } from "@/components/auth-pages";

export const metadata: Metadata = {
  title: "Recover Your Login Email — PicTools",
  description: "Find the email address associated with your PicTools account.",
};

export default function ForgotEmailRoute() {
  return (
    <Suspense>
      <ForgotEmailPage />
    </Suspense>
  );
}
