'use server';

/**
 * @fileOverview An AI agent that answers questions, either from its general knowledge or about an uploaded document.
 *
 * - answerQuestions - A function that answers questions.
 * - AnswerQuestionsInput - The input type for the answerQuestions function.
 * - AnswerQuestionsOutput - The return type for the answerQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerQuestionsInputSchema = z.object({
  question: z.string().describe('The question to answer.'),
  documentContent: z.string().optional().describe('The content of the document to answer the question from.'),
});
export type AnswerQuestionsInput = z.infer<typeof AnswerQuestionsInputSchema>;

const AnswerQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
  reasoning: z.string().describe('The reasoning behind the answer.'),
});
export type AnswerQuestionsOutput = z.infer<typeof AnswerQuestionsOutputSchema>;

export async function answerQuestions(input: AnswerQuestionsInput): Promise<AnswerQuestionsOutput> {
  return answerQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerQuestionsPrompt',
  input: {schema: AnswerQuestionsInputSchema},
  output: {schema: AnswerQuestionsOutputSchema},
  prompt: `You are a helpful AI assistant.
  {{#if documentContent}}
You will answer the user's question based *only* on the content of the document provided below. If the answer is not found in the document, you must state that the information is not available in the provided text. You must also provide a brief explanation of your reasoning for the answer.

Document Content:
---
{{{documentContent}}}
---
  {{else}}
You will answer the user's question from your general knowledge.
  {{/if}}

Question: {{{question}}}
`,
});

const answerQuestionsFlow = ai.defineFlow(
  {
    name: 'answerQuestionsFlow',
    inputSchema: AnswerQuestionsInputSchema,
    outputSchema: AnswerQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
