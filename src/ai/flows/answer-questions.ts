
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

const HistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const AnswerQuestionsInputSchema = z.object({
  question: z.string().describe('The question to answer.'),
  model: z.string().optional().describe('The model to use for the answer.'),
  history: z.array(HistoryItemSchema).optional().describe('The history of the conversation.'),
  documentContent: z.string().optional().describe('The content of the document to answer the question from.'),
  imageDataUri: z
    .string()
    .optional()
    .describe(
      "An image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
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
  prompt: `You are a helpful AI assistant. Your responses should be informative and well-structured.
When you are asked to generate code, you must wrap it in markdown-style triple backticks, specifying the language. For example:
\`\`\`javascript
console.log("Hello, world!");
\`\`\`

  {{#if documentContent}}
You will answer the user's question based *only* on the content of the document provided below. If the answer is not found in the document, you must state that the information is not available in the provided text. You must also provide a brief explanation of your reasoning for the answer.

Document Content:
---
{{{documentContent}}}
---
  {{else if imageDataUri}}
You will answer the user's question based on the provided image.
Image:
{{media url=imageDataUri}}
  {{else}}
You will answer the user's question from your general knowledge.
  {{/if}}

{{#if history}}
Here is the conversation history:
{{#each history}}
{{this.role}}: {{{this.content}}}
{{/each}}
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
  async (input) => {
    const model = input.model;
    
    try {
      const {output} = await prompt(input, {model});
      return output!;
    } catch (e: any) {
      if (e.message) {
        if (e.message.includes('[429 Too Many Requests]')) {
          return {
            answer: `I'm sorry, but I've hit the request limit for the selected model (\`${input.model}\`). Please try again in a little while, or select a different model from the settings.`,
            reasoning: 'API rate limit exceeded.',
          };
        }
        if (e.message.includes('[503 Service Unavailable]')) {
           return {
            answer: `I'm sorry, but the selected model (\`${input.model}\`) is currently overloaded. Please try again in a moment, or select a different model.`,
            reasoning: 'Model service unavailable.',
          };
        }
      }
      // Re-throw other errors
      throw e;
    }
  },
);
