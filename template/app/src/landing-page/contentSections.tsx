import daBoiAvatar from "../client/static/da-boi.webp";
import kivo from "../client/static/examples/kivo.webp";
import messync from "../client/static/examples/messync.webp";
import microinfluencerClub from "../client/static/examples/microinfluencers.webp";
import promptpanda from "../client/static/examples/promptpanda.webp";
import reviewradar from "../client/static/examples/reviewradar.webp";
import scribeist from "../client/static/examples/scribeist.webp";
import searchcraft from "../client/static/examples/searchcraft.webp";
import { BlogUrl, DocsUrl } from "../shared/common";
import type { GridFeature } from "./components/FeaturesGrid";

export const features: GridFeature[] = [
  {
    name: "Plan in seconds",
    description: "Go from a messy list to a full daily plan with one click",

    emoji: "🪄",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Fits your hours",
    description: "Tell it how long you'll work and the plan fits that time",

    emoji: "⏱️",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Priorities first",
    description:
      "High-priority tasks land at the top, so the important work gets done",
    emoji: "🎯",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Big tasks, small steps",
    description:
      "Every task is split into at least three concrete subtasks, each with its own time estimate",
    emoji: "🧩",
    href: DocsUrl,
    size: "large",
  },
  {
    name: "Saved to your account",
    description:
      "Your tasks and generated plans stay in your account, ready when you come back",
    emoji: "🗂️",
    href: DocsUrl,
    size: "large",
  },
  {
    name: "Works anywhere",
    description: "Use it in any browser, on desktop or phone",

    emoji: "📱",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Secure sign-in",
    description: "Email, Google, GitHub or Discord",

    emoji: "🔐",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Powered by AI",
    description:
      "Built on OpenAI models that understand how real work breaks down",
    emoji: "🤖",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Free to start",
    description:
      "Try it with free credits, then upgrade when it becomes part of your day",
    emoji: "🚀",
    href: DocsUrl,
    size: "medium",
  },
];

export const testimonials = [
  {
    name: "Da Boi",
    role: "Wasp Mascot",
    avatarSrc: daBoiAvatar,
    socialUrl: "https://twitter.com/wasplang",
    quote: "I don't even know how to code. I'm just a plushie.",
  },
  {
    name: "Mr. Foobar",
    role: "Founder @ Cool Startup",
    avatarSrc: daBoiAvatar,
    socialUrl: "",
    quote: "This product makes me cooler than I already am.",
  },
  {
    name: "Jamie",
    role: "Happy Customer",
    avatarSrc: daBoiAvatar,
    socialUrl: "#",
    quote: "My cats love it!",
  },
];

export const faqs = [
  {
    id: 1,
    question: "How does Daybloom plan my day?",
    answer:
      "You add your tasks, mark how long each one should take, and set how many hours you'll work. Daybloom uses AI to split each task into smaller steps, give each step a time, and order everything by priority.",
  },
  {
    id: 2,
    question: "Is it free?",
    answer:
      "New accounts get free credits, and each plan you generate uses one. When you run out, you can buy more credits or subscribe for unlimited planning.",
    href: "/pricing",
  },
  {
    id: 3,
    question: "Can I change the plan it gives me?",
    answer:
      "Yes. Edit your task list or working hours and generate a new plan whenever your day changes.",
  },
  {
    id: 4,
    question: "What happens to my data?",
    answer:
      "Your tasks and plans are stored in your account and used only to generate your schedule. Task text is sent to OpenAI to create the plan.",
  },
];

export const footerNavigation = {
  app: [
    { name: "Documentation", href: DocsUrl },
    { name: "Blog", href: BlogUrl },
  ],
  company: [
    { name: "Pricing", href: "/pricing" },
    { name: "Privacy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

export const examples = [
  {
    name: "Example #1",
    description: "Describe your example here.",

    imageSrc: kivo,
    href: "#",
  },
  {
    name: "Example #2",
    description: "Describe your example here.",

    imageSrc: messync,
    href: "#",
  },
  {
    name: "Example #3",
    description: "Describe your example here.",

    imageSrc: microinfluencerClub,
    href: "#",
  },
  {
    name: "Example #4",
    description: "Describe your example here.",

    imageSrc: promptpanda,
    href: "#",
  },
  {
    name: "Example #5",
    description: "Describe your example here.",

    imageSrc: reviewradar,
    href: "#",
  },
  {
    name: "Example #6",
    description: "Describe your example here.",

    imageSrc: scribeist,
    href: "#",
  },
  {
    name: "Example #7",
    description: "Describe your example here.",

    imageSrc: searchcraft,
    href: "#",
  },
];
