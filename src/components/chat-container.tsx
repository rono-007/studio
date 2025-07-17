
"use client";

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Bot, User, Paperclip, SendHorizonal, Loader2, FileText, Settings, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { parseDocument } from '@/ai/flows/parse-document';
import { answerQuestions } from '@/ai/flows/answer-questions';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type DocumentState = {
  name: string;
  content: string;
} | null;


export type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
    document: DocumentState;
}

interface ChatContainerProps {
    session: ChatSession;
    onSessionUpdate: (session: ChatSession) => void;
}

export function ChatContainer({ session, onSessionUpdate }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(session.messages);
  const [documentState, setDocumentState] = useState<DocumentState>(session.document);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let title = session.title;
    if(title === 'New Chat' && messages.length > 1) {
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage) {
            title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
        }
    } else if (documentState && title === 'New Chat') {
        title = documentState.name;
    }
    
    const updatedSession: ChatSession = { ...session, messages, document: documentState, title };
    onSessionUpdate(updatedSession);
  }, [messages, documentState]);
  
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('Parsing document...');
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const dataUri = reader.result as string;
        const { parsedText } = await parseDocument({ documentDataUri: dataUri });
        
        const newDocState = { name: file.name, content: parsedText };
        setDocumentState(newDocState);

        const systemMessage: Message = {
            id: Date.now().toString(),
            role: 'system',
            content: `Successfully parsed "${file.name}". You can now ask questions about it.`,
        };
        setMessages(prev => [...prev, systemMessage]);

      } catch (error) {
        console.error('Parsing failed:', error);
        toast({
          variant: 'destructive',
          title: 'Parsing Failed',
          description: 'Could not parse the document. Please try another file.',
        });
        const errorMessage: Message = { id: Date.now().toString(), role: 'assistant', content: "Sorry, I couldn't read that document. Please try another one." };
        setMessages(prev => [...prev, errorMessage]);
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

  const removeDocument = () => {
      const docName = documentState?.name;
      setDocumentState(null);
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Removed document "${docName}". The conversation will now be based on general knowledge.`,
      };
      setMessages(prev => [...prev, systemMessage]);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingMessage('Thinking...');

    try {
      const { answer } = await answerQuestions({
        question: input,
        documentContent: documentState?.content,
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Bot className="text-primary" /> ParseAI
        </CardTitle>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Chat
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear all messages in this chat. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                          setMessages([{
                              id: 'init',
                              role: 'assistant',
                              content: 'Hello! Ask me anything, or upload a document to ask questions about it.',
                          }]);
                          setDocumentState(null);
                      }}>Clear</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden flex flex-col">
        {documentState && (
            <div className="mb-4 p-3 rounded-md bg-muted/50 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">{documentState.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeDocument}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )}
        <ScrollArea className="h-full pr-4 flex-grow" viewportRef={scrollViewportRef}>
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
            placeholder={documentState ? `Ask about ${documentState.name}...` : "Ask a question..."}
            disabled={isLoading}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send message">
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
