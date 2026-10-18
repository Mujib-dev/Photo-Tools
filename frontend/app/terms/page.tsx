import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of PicTools.",
};

export default function TermsRoute() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 2026"
      intro="These terms govern your use of the PicTools applications and tools provided by LynkZone. By using the service you agree to them."
    >
      <LegalSection heading="1. Acceptance of terms">
        <p>
          By accessing or using PicTools you agree to be bound by these terms. If you do not agree,
          please do not use the service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Use of the service">
        <p>You agree to use PicTools lawfully and not to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>process content you do not have the rights to use;</li>
          <li>upload malware or attempt to disrupt, overload or bypass the security of the service;</li>
          <li>use the service to create unlawful, infringing or harmful material.</li>
        </ul>
        <p>
          You are responsible for the files you process and for keeping your account credentials
          secure.
        </p>
      </LegalSection>

      <LegalSection heading="3. Accounts">
        <p>
          Some features require an account. You must provide accurate information and are responsible
          for all activity under your account. We may suspend or terminate accounts that violate these
          terms.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your content">
        <p>
          You retain all rights to the files you process. We claim no ownership over your content.
          Files are handled on the host machine and deleted after the retention period, as described
          in our{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="5. Availability and changes">
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Tools
          and features may change, be interrupted or be discontinued at any time without notice.
        </p>
      </LegalSection>

      <LegalSection heading="6. Disclaimer of warranties">
        <p>
          To the fullest extent permitted by law, PicTools is provided without warranties of any kind,
          express or implied, including fitness for a particular purpose and non-infringement. You use
          the tools at your own discretion and risk.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of liability">
        <p>
          To the maximum extent permitted by law, LynkZone is not liable for any indirect, incidental
          or consequential damages, or for any loss of data, profits or files arising from your use of
          the service. Always keep your own backups of important files.
        </p>
      </LegalSection>

      <LegalSection heading="8. Contact">
        <p>
          Questions about these terms? Reach the PicTools team via the{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">
            contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
