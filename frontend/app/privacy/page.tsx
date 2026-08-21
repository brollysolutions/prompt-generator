import type { Metadata } from "next";
import Link from "next/link";
// Shared app chrome (wave background, #F3F3F3 body, scrollbar styling). Despite
// living under /generator, this is the stylesheet the rest of the app's pages
// are written against.
import "../generator/generator.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Smart Prompt Generator collects, uses, and protects your data across the web app and Chrome extension.",
};

const LAST_UPDATED = "2026-08-21";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Animated wave background, same as the home and share pages. */}
      <div className="bg-wave-container">
        <svg
          className="waves"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
          shapeRendering="auto"
        >
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
          </defs>
          <g className="parallax">
            <use xlinkHref="#gentle-wave" x="48" y="0" />
            <use xlinkHref="#gentle-wave" x="48" y="3" />
            <use xlinkHref="#gentle-wave" x="48" y="5" />
            <use xlinkHref="#gentle-wave" x="48" y="7" />
          </g>
        </svg>
      </div>

      {/* Standalone nav: the shared Header renders nothing when logged out, and a
          privacy policy is mostly read by signed-out visitors. */}
      <nav className="sticky top-0 z-50 border-b border-[#D4AF37]/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
            Smart Prompt Generator
          </Link>
          <Link
            href="/"
            className="text-sm font-bold text-[#AA8A27] transition-colors hover:text-[#8A7322]"
          >
            Back to home
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-[860px] px-4 py-12 md:py-16">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#D4AF37]/30 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#AA8A27] shadow-sm">
            Legal
          </span>
          <h1
            className="bg-gradient-to-r from-[#D4AF37] via-[#AA8A27] to-[#D4AF37] bg-clip-text py-2 text-4xl tracking-normal text-transparent md:text-5xl"
            style={{ fontFamily: "'Merriweather', serif", fontWeight: 400 }}
          >
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="rounded-3xl border border-white/50 bg-white/90 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl md:p-10">
          <p className="leading-relaxed text-gray-700">
            This policy covers Smart Prompt Generator&apos;s web app (brollysolutions.in) and its
            companion Chrome extension. Both share the same account and the same backend, so this
            page applies to whichever one you use.
          </p>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              What we collect
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed text-gray-700">
              <li>
                <strong className="text-gray-900">Account details:</strong> your email address, and
                either a hashed password or, if you use &ldquo;Sign in with Google&rdquo;, the basic
                profile info Google provides during that sign-in. We never store your password in
                plain text.
              </li>
              <li>
                <strong className="text-gray-900">Prompt content:</strong> the ideas, selected text,
                and prompts you generate, enhance, score, test, or save to your Library or History.
              </li>
              <li>
                <strong className="text-gray-900">Community content:</strong> any prompt you
                explicitly choose to publish to the Community section becomes visible to other
                users, along with your email address. The app only displays the part before the
                &ldquo;@&rdquo; next to your post, but the full email address is included in the
                data returned to anyone browsing Community, including visitors who aren&apos;t
                logged in.
              </li>
              <li>
                <strong className="text-gray-900">Share links:</strong> using &ldquo;Share&rdquo; on
                a prompt creates a public link that lets anyone who has it view that prompt&apos;s
                text, quality score, category, language, the author name you gave it, and how many
                times the link has been viewed &mdash; no account or login required to view it. This
                is true even if you choose the &ldquo;Unlisted&rdquo; option; it only keeps the link
                out of any public listing, it doesn&apos;t restrict who can open it. Anyone with the
                link can also save the prompt to their own Library if they&apos;re logged in. You
                can set the link to expire in 7 or 30 days when you create it, or leave it open
                indefinitely.
              </li>
              <li>
                <strong className="text-gray-900">Usage data:</strong> when you&apos;re logged in,
                we record your category choices and quality scores against your account to power
                your Analytics and Report Card views. Separately, every prompt that gets scored
                &mdash; whether or not you&apos;re logged in &mdash; is logged with its text, score,
                suggestions, and rewritten version for quality-scoring purposes; those records
                aren&apos;t linked to your account.
              </li>
              <li>
                <strong className="text-gray-900">Session tokens:</strong> a JWT issued on login,
                used to keep you signed in.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              How your prompts are processed
            </h2>
            <p className="mt-4 leading-relaxed text-gray-700">
              When you generate, enhance, score, or test a prompt, its text is sent to a third-party
              AI provider &mdash; Google Gemini or Groq (Llama 3.3), depending on the request and
              the language it&apos;s written in &mdash; to produce a response. We don&apos;t control
              how those providers handle that text once it reaches them; see{" "}
              <a
                href="https://ai.google.dev/gemini-api/terms"
                className="font-semibold text-[#AA8A27] underline hover:text-[#8A7322]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google&apos;s
              </a>{" "}
              and{" "}
              <a
                href="https://groq.com/privacy-policy/"
                className="font-semibold text-[#AA8A27] underline hover:text-[#8A7322]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Groq&apos;s
              </a>{" "}
              own policies for details. We don&apos;t sell prompt content, and we don&apos;t use it
              to train our own models.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              The Chrome extension, specifically
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed text-gray-700">
              <li>
                The extension only ever communicates with our own backend at{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
                  brollysolutions.in
                </code>
                . It has no access to any other website&apos;s data, and no network permission
                beyond that one host.
              </li>
              <li>
                It reads page content only when you explicitly invoke it &mdash; via the right-click
                menu or the toolbar popup &mdash; never automatically or in the background, and it
                does not track your browsing history.
              </li>
              <li>
                Your selected text or generated prompt is sent to our backend only at the moment you
                use Enhance, Score, Generate, or Test.
              </li>
              <li>
                Your login session is stored locally in the browser&apos;s extension storage, not in
                Chrome&apos;s account-wide sync storage, and is cleared when you log out.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              Your choices
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed text-gray-700">
              <li>You can delete individual History or Library entries at any time from the app.</li>
              <li>You can unpublish a prompt you shared to the Community.</li>
              <li>You can log out at any time, which clears your session locally.</li>
              <li>
                To request deletion of your account and associated data, contact us at{" "}
                <a
                  href="mailto:support@brollysolutions.in"
                  className="font-semibold text-[#AA8A27] underline hover:text-[#8A7322]"
                >
                  support@brollysolutions.in
                </a>
                .
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              Changes to this policy
            </h2>
            <p className="mt-4 leading-relaxed text-gray-700">
              If this policy changes materially, we&apos;ll update the date at the top of this page.
            </p>
          </section>

          <p className="mt-10 border-t border-gray-100 pt-6 text-sm text-gray-500">
            Questions? Reach us at{" "}
            <a
              href="mailto:support@brollysolutions.in"
              className="font-semibold text-[#AA8A27] underline hover:text-[#8A7322]"
            >
              support@brollysolutions.in
            </a>
            .{" "}
            <Link href="/" className="font-semibold text-[#AA8A27] underline hover:text-[#8A7322]">
              Back to home
            </Link>
            .
          </p>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
      `}</style>
    </div>
  );
}
