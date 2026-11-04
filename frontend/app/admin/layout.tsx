import type { Metadata } from "next";

import { AdminGate } from "@/components/admin-gate";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "LynkZone Admin Console — PicTools Enterprise",
  description:
    "Enterprise management for users, jobs, financial revenue, promo codes, support desk and system diagnostics by LynkZone.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
