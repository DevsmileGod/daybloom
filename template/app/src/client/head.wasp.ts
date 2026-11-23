import { type App } from "@wasp/spec";

export const head: App["head"] = [
  "<link rel='icon' href='/favicon.ico' />",

  "<meta name='description' content='Daybloom turns your to-do list into a realistic, AI-planned day: tasks broken into timed, prioritized steps that fit the hours you actually have.' />",
  "<meta name='author' content='Mitchell Gray' />",
  "<meta name='keywords' content='ai planner, daily planner, schedule, productivity, to-do list, time blocking' />",

  "<meta property='og:type' content='website' />",
  "<meta property='og:title' content='Daybloom' />",
  "<meta property='og:site_name' content='Daybloom' />",
  "<meta property='og:url' content='https://your-saas-app.com' />",
  "<meta property='og:description' content='Daybloom turns your to-do list into a realistic, AI-planned day: tasks broken into timed, prioritized steps that fit the hours you actually have.' />",
  "<meta property='og:image' content='https://your-saas-app.com/public-banner.webp' />",
  "<meta name='twitter:image' content='https://your-saas-app.com/public-banner.webp' />",
  "<meta name='twitter:image:width' content='800' />",
  "<meta name='twitter:image:height' content='400' />",
  "<meta name='twitter:card' content='summary_large_image' />",
  // TODO: You can put your Plausible analytics scripts below (https://docs.opensaas.sh/guides/analytics/):
  // NOTE: Plausible does not use Cookies, so you can simply add the scripts here.
  // Google, on the other hand, does, so you must instead add the script dynamically
  // via the Cookie Consent component after the user clicks the "Accept" cookies button.
  "<script async data-domain='<your-site-id>' src='https://plausible.io/js/script.js'></script>", // for production
  "<script async data-domain='<your-site-id>' src='https://plausible.io/js/script.local.js'></script>", // for development
];
