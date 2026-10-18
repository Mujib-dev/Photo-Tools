import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PicTools handles your data, files and account information.",
};

export default function PrivacyRoute() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 2026"
      intro="PicTools is built to keep your files on your own computer. This policy explains what we store, why, and the choices you have."
    >
      <LegalSection heading="1. Our approach">
        <p>
          PicTools is a set of image, document and video tools developed by LynkZone. Most processing
          runs locally: your photos, PDFs and videos are handled on the machine running the
          application and are not uploaded to us or to any third-party service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>We only collect what is needed to run the tools and your account:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">Account data.</span> When you sign up we
            store your email address and a securely hashed version of your password. We never store
            passwords in plain text.
          </li>
          <li>
            <span className="font-semibold text-foreground">Session data.</span> A signed-in session
            is tracked with a random token stored as a hash; a cookie (or session header on mobile)
            keeps you logged in until it expires.
          </li>
          <li>
            <span className="font-semibold text-foreground">Contact submissions.</span> If you use the
            contact form, we receive the name, email, phone number, subject and message you provide so
            we can reply.
          </li>
          <li>
            <span className="font-semibold text-foreground">Processing files.</span> Uploaded files
            and job output are stored only temporarily and are automatically deleted after the
            configured retention period.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use it">
        <p>
          Your information is used solely to provide and secure the service: authenticating your
          account, running the tools you request, replying to your messages, preventing abuse and
          troubleshooting. We do not sell your data or use it for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="4. Where your data lives">
        <p>
          Account and job records are kept in a local database on the host machine. When the stack is
          deployed with optional production services (such as PostgreSQL or Redis), your data is
          stored on infrastructure controlled by whoever operates that deployment.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data retention">
        <p>
          Temporary processing files are removed automatically after the retention window. Account
          records persist until you delete your account. Contact submissions are kept only as long as
          needed to handle your request.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your choices">
        <p>
          You can log out at any time, which invalidates your session. To request deletion of your
          account or data, contact us using the details on our{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">
            contact page
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          Passwords are hashed with scrypt, sessions are stored hashed, uploads are size-capped and
          validated, and only registered processing engines may run. No system is perfectly secure, so
          please use a strong, unique password.
        </p>
      </LegalSection>

      <LegalSection heading="8. Contact">
        <p>
          Questions about this policy? Reach the PicTools team via the{" "}
          <Link href="/contact" className="font-semibold text-primary hover:underline">
            contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
