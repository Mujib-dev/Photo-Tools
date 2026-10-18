import type { Metadata } from "next";

import { ContactPage } from "@/components/contact-page";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the PicTools team at LynkZone.",
};

export default function ContactRoute() {
  return <ContactPage />;
}
