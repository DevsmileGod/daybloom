import aiReadyDark from "../client/static/assets/aiready-dark.webp";
import aiReady from "../client/static/assets/aiready.webp";
import { HighlightedFeature } from "./components/HighlightedFeature";

export function AIReady() {
  return (
    <HighlightedFeature
      name="Your day, planned in seconds"
      description="List what you need to get done and how many hours you have. Daybloom breaks every task into concrete, timed steps and orders them by priority, so you always know what to do next."
      highlightedComponent={<AIReadyExample />}
      direction="row-reverse"
    />
  );
}

function AIReadyExample() {
  return (
    <div className="w-full">
      <img
        src={aiReady}
        alt="Daybloom AI-generated daily plan"
        loading="lazy"
        className="dark:hidden"
      />
      <img
        src={aiReadyDark}
        alt="Daybloom AI-generated daily plan"
        loading="lazy"
        className="hidden dark:block"
      />
    </div>
  );
}
