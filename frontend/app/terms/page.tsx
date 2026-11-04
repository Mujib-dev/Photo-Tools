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
      <LegalSection heading="1. Acceptance of these terms">
        <p>
          By accessing or using PicTools you agree to be bound by these terms and by our{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, please do not use the service. If you use PicTools on behalf of an
          organisation, you confirm that you have authority to accept these terms for that
          organisation.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>
          You must be at least the age of majority in your jurisdiction to create an account. If you
          are under that age, you may only use the service with the involvement and consent of a
          parent or legal guardian.
        </p>
      </LegalSection>

      <LegalSection heading="3. Accounts and security">
        <p>
          Some features require an account. You must provide accurate information and keep your
          credentials confidential. You are responsible for everything that happens under your
          account. Notify us promptly if you suspect unauthorised access.
        </p>
        <p>
          We may suspend or terminate accounts that breach these terms, that we reasonably believe are
          fraudulent or abusive, or that put the service or other users at risk.
        </p>
      </LegalSection>

      <LegalSection heading="4. Use of the service">
        <p>You agree to use PicTools lawfully and in accordance with these terms. In particular:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">Rights.</span> You may only process
            content that you own or are authorised to use. You must have the necessary rights, licences
            and consents for every file and link you submit.
          </li>
          <li>
            <span className="font-semibold text-foreground">Lawful purpose.</span> Do not use the
            service to create, store or distribute unlawful, infringing, defamatory, harassing or
            otherwise harmful material.
          </li>
          <li>
            <span className="font-semibold text-foreground">Respect our systems.</span> Do not upload
            malware, attempt to disrupt or overload the service, probe or bypass its security, or
            access data that is not yours.
          </li>
          <li>
            <span className="font-semibold text-foreground">Fair use.</span> Do not resell, wrap or
            automate the service in a way that materially degrades it for other users, and respect any
            published rate limits.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Prohibited activities">
        <p>You must not, and must not permit anyone else to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>copy, modify, reverse-engineer or attempt to extract the source code of the service, except as permitted by law or by an applicable open-source licence;</li>
          <li>remove or obscure any ownership notices, watermarks or attribution that we or a licensor place in the service;</li>
          <li>use the service to circumvent technological protection measures, paywalls, authentication or access controls on any third-party content;</li>
          <li>impersonate any person, or misrepresent your affiliation with any person or organisation; or</li>
          <li>use the service in breach of any applicable export control, sanctions or other law.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Your content">
        <p>
          You retain all rights to the files you process. We claim no ownership over your content. So
          that we can operate the tools you request, you grant us a limited, temporary licence to
          store, copy and process your files solely to provide the service, and to delete them
          afterwards. Files are handled on the host machine and deleted after the retention period
          described in our{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          You are responsible for keeping your own backups. Always keep the originals of important
          files, because automated processing can fail or produce unexpected results.
        </p>
      </LegalSection>

      <LegalSection heading="7. Our intellectual property">
        <p>
          The PicTools name, logo, interface, documentation and software are owned by LynkZone or its
          licensors and are protected by intellectual property laws. Except for the limited right to
          use the service under these terms, no rights are granted to you.
        </p>
      </LegalSection>

      <LegalSection heading="8. Local processing and URL downloads">
        <p>
          Most processing runs locally on the machine hosting the application. Where a tool accepts a
          link (for example, the downloader), it is intended for public, directly downloadable media
          and public streaming (HLS) sources that you are entitled to access. You must not use it to
          bypass digital rights management, paid access, authentication or the terms of any
          third-party service, and you are solely responsible for how you use a link and for complying
          with the terms of the source site.
        </p>
        <p>
          We are not affiliated with, endorsed by or sponsored by any third-party site or platform.
        </p>
      </LegalSection>

      <LegalSection heading="9. Credits, plans and pricing">
        <p>
          Some tools, limits or features may be offered for free, metered by an allowance (for
          example, a monthly credit balance), or as part of a paid plan. If you use a metered or paid
          feature, the applicable allowance, price and billing terms are shown before you confirm.
          Prices and allowances may change, and we will give notice of material changes through the
          service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Third-party software and services">
        <p>
          PicTools bundles or relies on third-party components and media tools (for example, FFmpeg
          and various open-source libraries). These components are provided under their own licences
          and notices, and we make no warranty on their behalf. Where you connect an optional
          third-party service, your use of it is governed by that provider&apos;s terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Availability, changes and beta features">
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Tools
          and features may change, be interrupted or be discontinued at any time without notice. We
          may label features as preview or beta; those are provided for evaluation and may be less
          reliable or withdrawn.
        </p>
      </LegalSection>

      <LegalSection heading="12. Disclaimer of warranties">
        <p>
          To the fullest extent permitted by law, PicTools is provided without warranties of any kind,
          express or implied, including merchantability, fitness for a particular purpose,
          accuracy and non-infringement. We do not warrant that processing will be uninterrupted,
          error-free or that results will meet your requirements. You use the tools at your own
          discretion and risk.
        </p>
      </LegalSection>

      <LegalSection heading="13. Limitation of liability">
        <p>
          To the maximum extent permitted by law, LynkZone is not liable for any indirect, incidental,
          special, consequential or punitive damages, or for any loss of data, files, profits,
          revenue or goodwill arising from or related to your use of the service. To the extent
          liability cannot be excluded, our total aggregate liability is limited to the greater of the
          amount you paid us in the twelve months before the claim or a nominal sum.
        </p>
        <p>
          Nothing in these terms limits any liability that cannot lawfully be limited or excluded.
        </p>
      </LegalSection>

      <LegalSection heading="14. Indemnification">
        <p>
          You agree to indemnify and hold harmless LynkZone, its officers, employees and suppliers
          from any claims, damages, losses and expenses (including reasonable legal fees) arising out
          of your content, your use of the service, or your breach of these terms or of any law or
          third-party right.
        </p>
      </LegalSection>

      <LegalSection heading="15. Suspension and termination">
        <p>
          You may stop using the service at any time, and you may ask us to delete your account. We
          may suspend or terminate your access if you breach these terms, if required by law, or to
          protect the service or other users. On termination, your right to use the service ends, and
          provisions that by their nature should survive (such as intellectual property,
          disclaimers, limitation of liability and indemnification) will continue to apply.
        </p>
      </LegalSection>

      <LegalSection heading="16. Governing law and disputes">
        <p>
          These terms are governed by the laws applicable at LynkZone&apos;s principal place of
          business, without regard to conflict-of-law rules. The courts located there will have
          exclusive jurisdiction, unless mandatory consumer law in your country of residence gives you
          the right to bring proceedings locally. Before starting formal proceedings, we ask that you
          contact us so we can try to resolve the matter informally.
        </p>
      </LegalSection>

      <LegalSection heading="17. Changes to these terms">
        <p>
          We may update these terms from time to time. When we do, we will revise the
          &quot;Last updated&quot; date above and, for material changes, provide reasonable notice
          within the service. Your continued use after a change takes effect means you accept the
          updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="18. Contact">
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
