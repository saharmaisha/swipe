import Link from 'next/link';

export const metadata = {
  title: 'Privacy & Terms | Veri',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Privacy & terms</h1>
          <p className="text-muted-foreground">
            This beta is designed to help users turn Pinterest inspiration into more affordable shopping options. These terms explain what data the app uses and what users should expect during the beta period.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">What Veri does</h2>
          <p className="text-sm text-muted-foreground leading-6">
            Veri imports Pinterest boards that you connect directly or paste as public board URLs. It analyzes the visual attributes of the pins you choose, generates search queries, and returns product matches from supported shopping providers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">Data we store</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-6">
            <li>Your account email and basic profile record.</li>
            <li>Pinterest board and pin metadata you import into the app.</li>
            <li>AI-generated analysis results and shopping search runs.</li>
            <li>Saved products you choose to keep in the app.</li>
            <li>Basic usage events needed to improve the beta and enforce rate limits.</li>
            <li>Feedback you submit through our feedback form.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">How Pinterest data is accessed</h2>
          <p className="text-sm text-muted-foreground leading-6">
            Veri accesses only publicly available Pinterest board pages. We do not connect to your Pinterest account or store any Pinterest credentials.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">Beta limitations</h2>
          <p className="text-sm text-muted-foreground leading-6">
            This is a beta product. Search quality, imports, and third-party integrations may occasionally fail or return incomplete results. Product pricing and availability can change after results are shown.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">Contact & feedback</h2>
          <p className="text-sm text-muted-foreground leading-6">
            If you need support or want to request deletion of your beta data, use our{' '}
            <a
              href={process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSdZiVn2V8Y7XobGhfzzw7271ixmZwxL3jdRKUj12ieq19v-nA/viewform?usp=dialog'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              feedback form
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
