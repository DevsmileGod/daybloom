import OpenAI from "openai";
import { env } from "wasp/server";
import * as z from "zod";
import { type GeneratedSchedule, generatedScheduleSchema } from "./schedule";

const openAi = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface ScheduleInputTask {
  description: string;
  /** Estimated hours as entered by the user, e.g. "1.5". */
  time: string;
}

/**
 * Asks OpenAI to break the given tasks down into a structured schedule that
 * fits into `hours`. Returns null when the model didn't call the tool.
 */
export async function generateScheduleWithGpt(
  tasks: ScheduleInputTask[],
  hours: number,
): Promise<GeneratedSchedule | null> {
  const parsedTasks = tasks.map(({ description, time }) => ({
    description,
    time,
  }));

  const completion = await openAi.chat.completions.create({
    model: "gpt-6-luna",
    reasoning_effort: "none",
    messages: [
      {
        role: "system",
        content:
          "you are an expert daily planner. you will be given a list of main tasks and an estimated time to complete each task. You will also receive the total amount of hours to be worked that day. Your job is to return a detailed plan of how to achieve those tasks by breaking each task down into at least 3 subtasks each. MAKE SURE TO ALWAYS CREATE AT LEAST 3 SUBTASKS FOR EACH MAIN TASK PROVIDED BY THE USER! YOU WILL BE REWARDED IF YOU DO.",
      },
      {
        role: "user",
        content: `I will work ${hours} hours today. Here are the tasks I have to complete: ${JSON.stringify(
          parsedTasks,
        )}. Please help me plan my day by breaking the tasks down into actionable subtasks with time and priority status.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "parseTodaysSchedule",
          description: "parses the days tasks and returns a schedule",
          parameters: z.toJSONSchema(generatedScheduleSchema),
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: {
        name: "parseTodaysSchedule",
      },
    },
    temperature: 1,
  });

  const gptResponse = completion.choices[0].message.tool_calls?.find(
    (call) => call.type === "function",
  )?.function.arguments;

  return gptResponse !== undefined
    ? generatedScheduleSchema.parse(JSON.parse(gptResponse))
    : null;
}
