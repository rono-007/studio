"use client";

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Bot, User, Paperclip, SendHorizonal, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { parseDocument } from '@/ai/flows/parse-document';
import { answerQuestions } from '@/ai/flows/answer-questions';
import { useToast } from '@/hooks/use-toast';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type DocumentState = {
  name: string;
  content: string;
} | null;

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [documentState, setDocumentState] = useState<DocumentState>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedDoc = localStorage.getItem('parseai_document');
      if (storedDoc) {
        setDocumentState(JSON.parse(storedDoc));
      }
      const storedMessages = localStorage.getItem('parseai_messages');
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      } else {
        setMessages([
          {
            id: 'init',
            role: 'assistant',
            content: 'Hello! Upload a document to get started.',
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to load from localStorage", error);
      setMessages([
        {
          id: 'init-error',
          role: 'assistant',
          content: 'Hello! Upload a document to get started.',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    try {
      if (messages.length) {
        localStorage.setItem('parseai_messages', JSON.stringify(messages));
      }
      if (documentState) {
        localStorage.setItem('parseai_document', JSON.stringify(documentState));
      }
    } catch (error) {
       console.error("Failed to save to localStorage", error);
    }
  }, [messages, documentState]);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('Parsing document...');
    
    // Reset chat history for new document
    const initialMessages: Message[] = [];
    setMessages(initialMessages);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const dataUri = reader.result as string;
        const { parsedText } = await parseDocument({ documentDataUri: dataUri });
        
        setDocumentState({ name: file.name, content: parsedText });
        setMessages([
          ...initialMessages,
          {
            id: Date.now().toString(),
            role: 'system',
            content: `Successfully parsed "${file.name}". You can now ask questions about it.`,
          },
        ]);
      } catch (error) {
        console.error('Parsing failed:', error);
        toast({
          variant: 'destructive',
          title: 'Parsing Failed',
          description: 'Could not parse the document. Please try another file.',
        });
        setMessages([
            ...initialMessages,
            { id: Date.now().toString(), role: 'assistant', content: "Sorry, I couldn't read that document. Please try another one." }
        ]);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    };
    reader.onerror = (error) => {
        console.error('File reading failed:', error);
        toast({
          variant: 'destructive',
          title: 'File Error',
          description: 'There was an error reading your file.',
        });
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !documentState) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingMessage('Thinking...');

    try {
      const { answer } = await answerQuestions({
        question: input,
        documentContent: documentState.content,
      });
      const assistantMessage: Message = { id: Date.now().toString() + 'ai', role: 'assistant', content: answer };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Answering failed:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + 'err',
        role: 'assistant',
        content: "Sorry, I encountered an error while trying to answer. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <Card className="w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Bot className="text-primary" /> ParseAI
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4" viewportRef={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role !== 'user' && (
                  <Avatar className="w-8 h-8 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {message.role === 'assistant' ? <Bot size={20} /> : <FileText size={20} />}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  message.role === 'user' ? 'bg-primary text-primary-foreground' :
                  message.role === 'system' ? 'bg-muted/50 text-muted-foreground italic text-sm' :
                  'bg-secondary'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                 {message.role === 'user' && (
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback>
                      <User size={20} />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4">
                 <Avatar className="w-8 h-8 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot size={20} />
                    </AvatarFallback>
                  </Avatar>
                <div className="rounded-lg px-4 py-2 bg-secondary flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm">{loadingMessage}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-6">
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
            />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload document"
            disabled={isLoading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={documentState ? `Ask about ${documentState.name}...` : "Upload a document to start"}
            disabled={isLoading || !documentState}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim() || !documentState} aria-label="Send message">
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
