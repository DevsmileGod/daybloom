import { FAQ } from "./components/FAQ";
import { FeaturesGrid } from "./components/FeaturesGrid";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { SchemaMarkup } from "./components/SchemaMarkup";
import { faqs, features, footerNavigation } from "./contentSections";
import { AIReady } from "./ExampleHighlightedFeature";

export function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <SchemaMarkup />
      <main className="isolate">
        <Hero />
        <AIReady />
        <FeaturesGrid features={features} />
        <FAQ faqs={faqs} />
      </main>
      <Footer footerNavigation={footerNavigation} />
    </div>
  );
}
