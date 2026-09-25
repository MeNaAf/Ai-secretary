import { askAI } from "./openrouter.js";

export type SecretaryPlan = {
  response: string;
};

export async function runSecretary(input: { userId: string; message: string }): Promise<SecretaryPlan> {
  const result = await askAI([
    {
      role: "system",
      content: "You are AI Secretary. Turn the user's request into a concise, practical response. Do not invent external data or claim an action was executed."
    },
    { role: "user", content: input.message }
  ]);

  return { response: result.content };
}
