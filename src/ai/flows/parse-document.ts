// This is an auto-generated file from Firebase Studio.
'use server';

/**
 * @fileOverview A document parsing AI agent.
 *
 * - parseDocument - A function that handles the document parsing process.
 * - ParseDocumentInput - The input type for the parseDocument function.
 * - ParseDocumentOutput - The return type for the parseDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseDocumentInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A document (PDF, DOCX, or image) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ParseDocumentInput = z.infer<typeof ParseDocumentInputSchema>;

const ParseDocumentOutputSchema = z.object({
  parsedText: z.string().describe('The parsed text content of the document.'),
});
export type ParseDocumentOutput = z.infer<typeof ParseDocumentOutputSchema>;

export async function parseDocument(input: ParseDocumentInput): Promise<ParseDocumentOutput> {
  return parseDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseDocumentPrompt',
  input: {schema: ParseDocumentInputSchema},
  output: {schema: ParseDocumentOutputSchema},
  prompt: `You are a document parsing expert. Your task is to extract the text content from the given document.

  Document: {{media url=documentDataUri}}`,
});

const parseDocumentFlow = ai.defineFlow(
  {
    name: 'parseDocumentFlow',
    inputSchema: ParseDocumentInputSchema,
    outputSchema: ParseDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
