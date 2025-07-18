
"use client";

import { useState, useEffect, useRef, type FormEvent, useCallback } from 'react';
import { Bot, User, Paperclip, SendHorizonal, Loader2, FileText, Settings, X, Trash2, LogIn, Copy, Check, Sun, Moon } from 'lucide-react';
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
import { generateTitle } from '@/ai/flows/generate-title';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { useTypewriter } from '@/hooks/use-typewriter';
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
} from "@/components/ui/alert-dialog";
import { useTheme } from '@/context/theme-context';

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

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md text-white/50 bg-black/30 hover:bg-black/50 hover:text-white transition-colors"
        aria-label="Copy code"
      >
        {isCopied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <SyntaxHighlighter language={language} style={atomDark} customStyle={{ margin: 0 }}>
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const ThinkingIndicator = () => (
    <div className="flex items-center space-x-1">
        <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
    </div>
);


const models = {
  "Text-out models": [
    { id: "googleai/gemini-2.5-pro-preview-06-17", name: "Gemini 2.5 Pro", description: "Most capable model for complex reasoning." },
    { id: "googleai/gemini-2.5-flash-preview-06-17", name: "Gemini 2.5 Flash", description: "Fast and capable model for general tasks." },
    { id: "googleai/gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Older generation flash model." },
    { id: "googleai/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", description: "Older generation lightweight flash model." },
    { id: "googleai/gemini-1.5-flash-latest", name: "Gemini 1.5 Flash", description: "Fast and cost-effective multimodal model." },
    { id: "googleai/gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash-Lite Preview 06-17", description: "The lightest and fastest model in the Gemini family." },
  ]
};

const allModels = Object.values(models).flat();
const textGenerationModels = models["Text-out models"];

const AssistantMessage = ({ message, isLastMessage, onAnimate, isLoading }: { message: Message; isLastMessage: boolean; onAnimate: () => void; isLoading: boolean }) => {
  const animatedContent = useTypewriter(message.content, 5, { onUpdate: onAnimate });
  const contentToRender = isLastMessage && !isLoading ? animatedContent : message.content;

  const renderContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
  
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <p key={`${message.id}-text-${lastIndex}`} className="text-sm whitespace-pre-wrap">
            {content.substring(lastIndex, match.index)}
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
  
    if (lastIndex < content.length) {
      parts.push(
        <p key={`${message.id}-text-${lastIndex}`} className="text-sm whitespace-pre-wrap">
          {content.substring(lastIndex)}
        </p>
      );
    }
  
    return parts;
  };

  return <>{renderContent(contentToRender)}</>;
};


export function ChatContainer({ session, onSessionUpdate }: ChatContainerProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState("googleai/gemini-2.5-flash-lite-preview-06-17");
  
  const { user } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [isLoading, session.messages, scrollToBottom]);

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
  };

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

    if (!textGenerationModels.some(m => m.id === selectedModel)) {
      toast({
        variant: "destructive",
        title: "Incompatible Model",
        description: `The selected model (${allModels.find(m => m.id === selectedModel)?.name || 'Unknown'}) cannot be used for generating chat responses. Please select a model from the "Text-out models" category.`,
      });
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessageContent };
    const updatedMessages = [...session.messages, userMessage];
    
    // Optimistically update messages
    onSessionUpdate(session.id, { messages: updatedMessages });

    setInput('');
    setIsLoading(true);
    setLoadingMessage('Thinking...');
  
    try {
      // Generate title if it's a new chat
      if (session.title === 'New Chat' && userMessageContent.length > 0) {
        // Run title generation in parallel with answering the question
        generateTitle({ message: userMessageContent }).then(({ title }) => {
          onSessionUpdate(session.id, { title });
        }).catch(err => {
          console.error("Failed to generate title:", err);
          // Fallback to old title logic if AI fails
          const fallbackTitle = userMessageContent.substring(0, 30) + (userMessageContent.length > 30 ? '...' : '');
          onSessionUpdate(session.id, { title: fallbackTitle });
        });
      }

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


  const currentModelName = allModels.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <Card className="w-full h-full flex flex-col rounded-lg border bg-card/80 backdrop-blur-sm shadow-none">
      <CardHeader className="flex flex-row items-center py-4 px-6 shrink-0 pb-0">
        <div className="flex w-1/3 justify-start">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        </div>
        <div className="flex flex-col items-center flex-1">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 font-headline">
            <Bot className="text-primary" /> Infinitus
            </CardTitle>
            <p className="text-xs text-muted-foreground/70 font-mono tracking-tight">
            powered by Gemini advanced models
            </p>
        </div>
        <div className="flex w-1/3 justify-end">
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
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-6 pt-0 min-h-0 relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
            <div className="text-center font-headline text-6xl font-bold text-muted-foreground/20 select-none">
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
            {session.messages.map((message, index) => (
              <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''} animate-in`}>
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
                  'bg-muted'
                }`}>
                   {message.role === 'assistant' ? (
                      <AssistantMessage 
                        message={message} 
                        isLastMessage={index === session.messages.length - 1}
                        isLoading={isLoading}
                        onAnimate={scrollToBottom}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
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
            {isLoading && (
              <div className="flex items-start gap-4 animate-in">
                 <Avatar className="w-8 h-8 border border-primary/20">
                    <AvatarImage src="https://t4.ftcdn.net/jpg/09/43/48/93/360_F_943489384_zq3u5kkefFjPY3liE6t81KrX8W3lvxSz.jpg" alt="AI Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot size={20} />
                    </AvatarFallback>
                  </Avatar>
                <div className="rounded-lg px-4 py-3 bg-secondary flex items-center gap-2">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-6 shrink-0 flex flex-col gap-2">
        <div
            key={selectedModel}
            className="text-center text-xs text-muted-foreground font-mono animate-in fade-in zoom-in-95"
        >
            Using: <span className="font-semibold text-foreground">{currentModelName}</span>
        </div>
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
            placeholder={session.document ? `Ask about ${session.document.name}...` : "Ask a question..."}
            disabled={isLoading}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send message">
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
                            Select a model to use for the conversation.
                        </p>
                    </div>
                    <RadioGroup value={selectedModel} onValueChange={handleModelChange}>
                      {Object.entries(models).map(([category, modelList]) => (
                        <div key={category} className="grid gap-2">
                          <Label className="font-semibold">{category}</Label>
                          {modelList.map((model) => (
                             <Label htmlFor={model.id} key={model.id} className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 has-[[data-state=checked]]:bg-muted cursor-pointer">
                                <RadioGroupItem value={model.id} id={model.id} className="mt-1"/>
                                <div className="grid gap-1.5">
                                  <span className="font-normal text-xs font-mono">{model.name}</span>
                                  <p className="text-xs text-muted-foreground">{model.description}</p>
                                </div>
                              </Label>
                            )
                           )}
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

    