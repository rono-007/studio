
"use client";

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Bot, User, Paperclip, SendHorizonal, Loader2, FileText, Settings, X, Trash2, LogIn } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDocument } from '@/ai/flows/parse-document';
import { answerQuestions } from '@/ai/flows/answer-questions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { ProgressCircle } from './ui/progress-circle';
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

const models = {
  "Advanced": [
     { id: "googleai/gemini-2.5-pro", name: "Gemini 2.5 Pro", limit: 100 },
     { id: "googleai/gemini-2.5-flash", name: "Gemini 2.5 Flash", limit: 250 },
     { id: "googleai/gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash-Lite Preview 06-17", limit: 1000 },
  ],
  "General": [
    { id: "googleai/gemini-1.5-flash-latest", name: "Gemini 1.5 Flash (Default)", limit: 250 },
    { id: "googleai/gemini-2.0-flash", name: "Gemini 2.0 Flash", limit: 200 },
    { id: "googleai/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", limit: 200 },
  ]
}

const allModels = Object.values(models).flat();

type ModelUsage = {
  [modelId: string]: number;
};

const MODEL_USAGE_KEY = 'infinitus_model_usage';
const LAST_RESET_KEY = 'infinitus_last_reset';

export function ChatContainer({ session, onSessionUpdate }: ChatContainerProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState("googleai/gemini-1.5-flash-latest");
  const [modelUsage, setModelUsage] = useState<ModelUsage>({});
  
  const { user } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const userMessagesCount = session.messages.filter(m => m.role === 'user').length;
  const isGuestLimitReached = !user && userMessagesCount >= GUEST_MESSAGE_LIMIT;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastReset = localStorage.getItem(LAST_RESET_KEY);

    if (lastReset !== today) {
      localStorage.setItem(MODEL_USAGE_KEY, JSON.stringify({}));
      localStorage.setItem(LAST_RESET_KEY, today);
      setModelUsage({});
    } else {
      const storedUsage = localStorage.getItem(MODEL_USAGE_KEY);
      if (storedUsage) {
        setModelUsage(JSON.parse(storedUsage));
      }
    }
  }, []);

  const updateModelUsage = (modelId: string) => {
    const newUsage = { ...modelUsage };
    newUsage[modelId] = (newUsage[modelId] || 0) + 1;
    setModelUsage(newUsage);
    localStorage.setItem(MODEL_USAGE_KEY, JSON.stringify(newUsage));
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [session.messages, isLoading]);

  const clearActiveChat = () => {
    onSessionUpdate(session.id, {
      messages: [{
        id: 'init',
        role: 'assistant',
        content: 'hello, ask me anything!',
      }],
      document: null,
    });
  }

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    const modelName = allModels.find(m => m.id === modelId)?.name || modelId;
    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: `Switched to ${modelName} model.`,
    };
    onSessionUpdate(session.id, { messages: [...session.messages, systemMessage] });
  };

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
    
    const currentModelInfo = allModels.find(m => m.id === selectedModel);
    const usage = modelUsage[selectedModel] || 0;
    if (currentModelInfo && usage >= currentModelInfo.limit) {
      toast({
        variant: "destructive",
        title: "Model limit reached",
        description: `You have reached the daily limit for ${currentModelInfo.name}. Please select another model.`,
      });
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
        model: selectedModel,
      });
  
      const assistantMessage: Message = { id: Date.now().toString() + 'ai', role: 'assistant', content: answer };
      onSessionUpdate(session.id, { messages: [...updatedMessages, assistantMessage] });
      updateModelUsage(selectedModel);
    } catch (error: any) {
      console.error('Answering failed:', error);
       const errorMessageContent = error.message && error.message.includes('429') 
        ? `I'm sorry, but I've hit the request limit for the selected model (\`${selectedModel}\`). Please try again in a little while, or select a different model from the settings.`
        : "Sorry, I encountered an error while trying to answer. Please try again.";

      const errorMessage: Message = {
        id: Date.now().toString() + 'err',
        role: 'assistant',
        content: errorMessageContent,
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
    <Card className="w-full h-full flex flex-col shadow-none border-none rounded-none md:rounded-lg md:border">
      <CardHeader className="flex flex-row items-center justify-between py-4 px-6 shrink-0">
        <div className="w-10"></div> {/* Spacer for the right button */}
        <div className="flex flex-col items-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 font-headline">
            <Bot className="text-primary" /> Infinitus
            </CardTitle>
            <p className="text-xs text-muted-foreground/70 font-mono tracking-tight">
            powered by Gemini advanced models
            </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
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
              <AlertDialogAction onClick={clearActiveChat}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent className="flex-grow p-6 min-h-0 relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
            <div className="text-center font-headline text-6xl font-bold text-muted-foreground/10 select-none">
                <p>Anything.</p>
                <p>Everything.</p>
                <p>Just Ask.</p>
            </div>
        </div>
        <ScrollArea className="h-full pr-4 relative z-10" viewportRef={scrollAreaRef}>
          {session.document && (
              <div className="mb-4 p-3 rounded-md bg-muted/50 flex items-center justify-between text-sm sticky top-0 z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">{session.document.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeDocument}>
                      <X className="h-4 w-4" />
                  </Button>
              </div>
          )}
           <div className="space-y-6">
            {session.messages.map((message) => (
              <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role !== 'user' && (
                  <Avatar className="w-8 h-8 border border-primary/20">
                     <AvatarImage src="https://t4.ftcdn.net/jpg/09/43/48/93/360_F_943489384_zq3u5kkefFjPY3liE6t81KrX8W3lvxSz.jpg" alt="AI Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {message.role === 'assistant' ? <Bot size={20} /> : <FileText size={20} />}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  message.role === 'user' ? 'bg-primary text-primary-foreground' :
                  message.role === 'system' ? 'bg-muted/50 text-muted-foreground italic text-sm text-center w-full' :
                  'bg-secondary'
                }`}>
                   {message.role === 'assistant' ? renderMessageContent(message) : <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                </div>
                 {message.role === 'user' && (
                  <Avatar className="w-8 h-8 border">
                    <AvatarImage src="https://i.pinimg.com/736x/74/5d/34/745d347f866bdba46dc4f2dc649b7d23.jpg" alt="User Avatar" />
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
                    <AvatarImage src="https://t4.ftcdn.net/jpg/09/43/48/93/360_F_943489384_zq3u5kkefFjPY3liE6t81KrX8W3lvxSz.jpg" alt="AI Avatar" />
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
      <CardFooter className="pt-6 shrink-0">
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
            disabled={isLoading || isGuestLimitReached}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={session.document ? `Ask about ${session.document.name}...` : "Ask a question..."}
            disabled={isLoading || isGuestLimitReached}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim() || isGuestLimitReached} aria-label="Send message">
            <SendHorizonal className="h-5 w-5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Model Info">
                <Settings className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Gemini AI Models</h4>
                        <p className="text-sm text-muted-foreground">
                            Select a model to use for the conversation. Limits reset daily.
                        </p>
                    </div>
                    <RadioGroup value={selectedModel} onValueChange={handleModelChange}>
                      {Object.entries(models).map(([category, modelList]) => (
                        <div key={category} className="grid gap-2">
                          <Label className="font-semibold">{category}</Label>
                          {modelList.map((model) => {
                            const usage = modelUsage[model.id] || 0;
                            const percentage = Math.max(0, 100 - (usage / model.limit) * 100);
                            return (
                             <Label htmlFor={model.id} key={model.id} className="flex items-center justify-between space-x-2 p-2 rounded-md hover:bg-muted/50 has-[[data-state=checked]]:bg-muted">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value={model.id} id={model.id} />
                                  <span className="font-normal text-xs font-mono">{model.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {model.limit - usage}/{model.limit}
                                  </span>
                                  <ProgressCircle percentage={percentage} size={20} />
                                </div>
                              </Label>
                            )
                           })}
                           <Separator className="my-2" />
                        </div>
                      ))}
                    </RadioGroup>
                </div>
            </PopoverContent>
          </Popover>
        </form>
      </CardFooter>
    </Card>
  );
}
