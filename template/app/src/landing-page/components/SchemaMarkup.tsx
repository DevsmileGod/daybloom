// JSON-LD structured data for SEO. Helps search engines and LLMs understand
// your app so it can appear in rich results and AI answers. Customize the
// placeholders below to match your product. See https://schema.org for types.
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://your-saas-app.com/#software",
      name: "Daybloom",
      description:
        "Daybloom turns your to-do list into a realistic, AI-planned day: tasks broken into timed, prioritized steps that fit the hours you actually have.",
      url: "https://your-saas-app.com",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Cross-platform",
      image: "https://your-saas-app.com/public-banner.webp",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://your-saas-app.com/#website",
      url: "https://your-saas-app.com",
      name: "Daybloom",
      description:
        "Daybloom turns your to-do list into a realistic, AI-planned day: tasks broken into timed, prioritized steps that fit the hours you actually have.",
    },
  ],
};

export function SchemaMarkup() {
  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
