
"use client";

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Bot, User, Paperclip, SendHorizonal, Loader2, FileText, Settings, X, Trash2, LogIn } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type DocumentState = {
  name: string;
  content: string;
  dataUri: string;
} | null;


export type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
    document: DocumentState;
}

interface ChatContainerProps {
    session: ChatSession;
    onSessionUpdate: (sessionId: string, updates: Partial<ChatSession>) => void;
}

const GUEST_MESSAGE_LIMIT = 5;

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  return (
    <SyntaxHighlighter language={language} style={atomDark}>
      {value}
    </SyntaxHighlighter>
  );
};


export function ChatContainer({ session, onSessionUpdate }: ChatContainerProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const { user } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const userMessagesCount = session.messages.filter(m => m.role === 'user').length;
  const isGuestLimitReached = !user && userMessagesCount >= GUEST_MESSAGE_LIMIT;

  const showVerificationToast = () => {
    toast({
        variant: "destructive",
        title: "Account not verified",
        description: "Please check your email to verify your account to get full access.",
    });
  }

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [session.messages, isLoading]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if(isGuestLimitReached) {
        toast({
            variant: "destructive",
            title: "Message limit reached",
            description: "Please sign up to continue.",
        });
        return;
    }

    if (user && !user.emailVerified) {
        showVerificationToast();
        return;
    }

    setIsLoading(true);
    setLoadingMessage('Parsing document...');
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const dataUri = reader.result as string;
        const { parsedText } = await parseDocument({ documentDataUri: dataUri });
        
        const newDocState = { name: file.name, content: parsedText, dataUri: dataUri };
        
        const systemMessage: Message = {
            id: Date.now().toString(),
            role: 'system',
            content: `Successfully parsed "${file.name}". You can now ask questions about it.`,
        };

        const title = session.title === 'New Chat' ? file.name : session.title;

        onSessionUpdate(session.id, {
            document: newDocState,
            messages: [...session.messages, systemMessage],
            title: title
        });

      } catch (error) {
        console.error('Parsing failed:', error);
        toast({
          variant: 'destructive',
          title: 'Parsing Failed',
          description: 'Could not parse the document. Please try another file.',
        });
        const errorMessage: Message = { id: Date.now().toString(), role: 'assistant', content: "Sorry, I couldn't read that document. Please try another one." };
        onSessionUpdate(session.id, { messages: [...session.messages, errorMessage] });
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
      const docName = session.document?.name;
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Removed document "${docName}". The conversation will now be based on general knowledge.`,
      };
      onSessionUpdate(session.id, { document: null, messages: [...session.messages, systemMessage] });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const userMessageContent = input.trim();
    if (!userMessageContent) return;

    if(isGuestLimitReached) {
        toast({
            variant: "destructive",
            title: "Message limit reached",
            description: "Please sign up to continue.",
        });
        return;
    }
    
    if (user && !user.emailVerified) {
        showVerificationToast();
        return;
    }
  
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessageContent };
    
    let title = session.title;
    if (title === 'New Chat' && userMessageContent.length > 0) {
      title = userMessageContent.substring(0, 30) + (userMessageContent.length > 30 ? '...' : '');
    }

    const updatedMessages = [...session.messages, userMessage];
    onSessionUpdate(session.id, { messages: updatedMessages, title });
    setInput('');

    setIsLoading(true);
    setLoadingMessage('Thinking...');
  
    try {
      const isImage = session.document?.dataUri?.startsWith('data:image');
      
      const history = updatedMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));
  
      const { answer } = await answerQuestions({
        question: userMessageContent,
        history,
        documentContent: session.document && !isImage ? session.document.content : undefined,
        imageDataUri: session.document && isImage ? session.document.dataUri : undefined,
      });
  
      const assistantMessage: Message = { id: Date.now().toString() + 'ai', role: 'assistant', content: answer };
      onSessionUpdate(session.id, { messages: [...updatedMessages, assistantMessage] });
    } catch (error) {
      console.error('Answering failed:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + 'err',
        role: 'assistant',
        content: "Sorry, I encountered an error while trying to answer. Please try again.",
      };
      onSessionUpdate(session.id, { messages: [...updatedMessages, errorMessage] });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const renderMessageContent = (message: Message) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
  
    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <p key={`${message.id}-text-${lastIndex}`} className="text-sm whitespace-pre-wrap">
            {message.content.substring(lastIndex, match.index)}
          </p>
        );
      }
      
      const language = match[1] || 'text';
      const code = match[2];
      parts.push(
        <div key={`${message.id}-code-${match.index}`} className="my-2 rounded-md overflow-hidden bg-[#2d2d2d]">
          <CodeBlock language={language} value={code.trim()} />
        </div>
      );
      
      lastIndex = codeBlockRegex.lastIndex;
    }
  
    if (lastIndex < message.content.length) {
      parts.push(
        <p key={`${message.id}-text-${lastIndex}`} className="text-sm whitespace-pre-wrap">
          {message.content.substring(lastIndex)}
        </p>
      );
    }
  
    return parts;
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
                          onSessionUpdate(session.id, {
                              messages: [{
                                  id: 'init',
                                  role: 'assistant',
                                  content: 'Hello! Ask me anything, or upload a document to ask questions about it.',
                              }],
                              document: null,
                          })
                      }}>Clear</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden flex flex-col">
        {session.document && (
            <div className="mb-4 p-3 rounded-md bg-muted/50 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">{session.document.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeDocument}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )}
        <ScrollArea className="h-full pr-4 flex-grow" viewportRef={scrollViewportRef}>
          <div className="space-y-6">
            {session.messages.map((message) => (
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
                   {message.role === 'assistant' ? renderMessageContent(message) : <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
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
             {isGuestLimitReached && (
                 <div className="flex items-center justify-center p-4 my-4 bg-muted rounded-lg">
                    <div className="text-center">
                        <p className="font-semibold text-destructive">Message limit reached</p>
                        <p className="text-sm text-muted-foreground">Please sign up to continue the conversation.</p>
                        <Button onClick={() => router.push('/login')} className="mt-4">
                            <LogIn className="mr-2 h-4 w-4" />
                            Sign Up
                        </Button>
                    </div>
                </div>
            )}
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
            disabled={isLoading || isGuestLimitReached || (!!user && !user.emailVerified)}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={session.document ? `Ask about ${session.document.name}...` : "Ask a question..."}
            disabled={isLoading || isGuestLimitReached || (!!user && !user.emailVerified)}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim() || isGuestLimitReached || (!!user && !user.emailVerified)} aria-label="Send message">
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
