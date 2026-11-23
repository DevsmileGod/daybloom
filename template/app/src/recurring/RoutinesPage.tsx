import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Separator } from "../client/components/ui/separator";
import { RecurringTasksSection } from "./components/RecurringTasksSection";
import { TemplatesSection } from "./components/TemplatesSection";

export function RoutinesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Routines"
        description="Put the tasks you repeat on autopilot. Recurring tasks land on your list by themselves, and templates add a whole set of tasks in one click."
      />
      <div className="mt-8 grid max-w-4xl gap-10">
        <RecurringTasksSection />
        <Separator />
        <TemplatesSection />
      </div>
    </PageContainer>
  );
}
