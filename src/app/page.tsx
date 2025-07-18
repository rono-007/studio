
"use client";

import { useState, useEffect, useRef } from 'react';
import { Bot, MessageSquarePlus, Trash2, Pencil, LogIn, LogOut } from 'lucide-react';
import { ChatContainer, type ChatSession } from '@/components/chat-container';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarProvider,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';

const GUEST_SESSIONS_KEY = 'infinitus_guest_sessions';
const ACTIVE_GUEST_SESSION_ID_KEY = 'infinitus_active_guest_session_id';

export default function Home({ params: {} }: { params: {} }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isClient, setIsClient] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const getSessionsKey = () => user ? `infinitus_sessions_${user.uid}` : GUEST_SESSIONS_KEY;
  const getActiveSessionIdKey = () => user ? `infinitus_active_session_id_${user.uid}` : ACTIVE_GUEST_SESSION_ID_KEY;

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isClient || loading) return;

    const sessionsKey = getSessionsKey();
    const activeIdKey = getActiveSessionIdKey();

    try {
      const storedSessions = localStorage.getItem(sessionsKey);
      const storedActiveId = localStorage.getItem(activeIdKey);

      let parsedSessions: ChatSession[] = [];
      if (storedSessions) {
        parsedSessions = JSON.parse(storedSessions);
      }

      if (parsedSessions.length > 0) {
        setSessions(parsedSessions);
        if (storedActiveId && parsedSessions.some(s => s.id === storedActiveId)) {
          setActiveSessionId(storedActiveId);
        } else {
          setActiveSessionId(parsedSessions[0].id);
        }
      } else {
        createNewSession();
      }
    } catch (error) {
      console.error("Failed to load sessions from localStorage", error);
      createNewSession();
    }
  }, [isClient, user, loading]);


  useEffect(() => {
    if (!isClient || loading) return;

    const sessionsKey = getSessionsKey();
    const activeIdKey = getActiveSessionIdKey();
    
    if (sessions.length > 0) {
      localStorage.setItem(sessionsKey, JSON.stringify(sessions));
    } else {
      localStorage.removeItem(sessionsKey);
    }
    if (activeSessionId) {
      localStorage.setItem(activeIdKey, activeSessionId);
    } else {
       localStorage.removeItem(activeIdKey);
    }
  }, [sessions, activeSessionId, isClient, user, loading]);

   useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingSessionId]);

  const createNewSession = () => {
    let welcomeMessage = 'hello, ask me anything!';
    if (user && user.displayName) {
      const firstName = user.displayName.split(' ')[0];
      welcomeMessage = `hello ${firstName}, ask me anything!`;
    }

    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat',
      messages: [
        {
          id: 'init',
          role: 'assistant',
          content: welcomeMessage,
        },
      ],
      document: null,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };
  
  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  }

  const deleteSession = (sessionId: string) => {
    setSessions(prev => {
        const newSessions = prev.filter(s => s.id !== sessionId);
        if (activeSessionId === sessionId) {
            if (newSessions.length > 0) {
                setActiveSessionId(newSessions[0].id);
            } else {
                // This case is hit when the last session is deleted
                setActiveSessionId(null);
                 createNewSession(); // create a new one to avoid empty state
            }
        }
        // If after deletion, no sessions are left, create a fresh one.
        if (newSessions.length === 0) {
            createNewSession();
        }
        return newSessions;
    });
  }

  const handleStartEdit = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  }

  const handleFinishEdit = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSession(editingSessionId, { title: editingTitle.trim() });
    }
    setEditingSessionId(null);
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      
      // Force a hard reload to clear all state and re-initialize
      router.push('/login');
      setTimeout(() => {
        window.location.reload();
      }, 100);

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Logout Failed",
            description: "An error occurred during logout. Please try again.",
        });
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  
  if (!isClient || loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Bot size={48} className="text-muted-foreground animate-pulse" />
        </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b">
           <Button variant="ghost" className="w-full justify-center h-8 rounded-[20px]" onClick={createNewSession}>
            <MessageSquarePlus />
            <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:ml-0 ml-2">New Chat</span>
          </Button>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {sessions.map((session) => (
              <SidebarMenuItem key={session.id}>
                <div className="group relative flex w-full items-center">
                  {editingSessionId === session.id ? (
                    <Input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={handleTitleChange}
                      onBlur={handleFinishEdit}
                      onKeyDown={handleEditKeyDown}
                      className="h-8 w-full"
                    />
                  ) : (
                    <SidebarMenuButton
                      variant="ghost"
                      onClick={() => setActiveSessionId(session.id)}
                      isActive={session.id === activeSessionId}
                      className="w-full truncate justify-center"
                    >
                      {session.title}
                    </SidebarMenuButton>
                  )}
                  {editingSessionId !== session.id && (
                    <div className="absolute right-1 flex items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <SidebarMenuAction onClick={() => handleStartEdit(session)}>
                        <Pencil />
                      </SidebarMenuAction>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <SidebarMenuAction>
                            <Trash2 />
                          </SidebarMenuAction>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this chat session.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSession(session.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="flex flex-col gap-y-2 items-center group-data-[collapsible=icon]:items-center">
            {user ? (
                <Button variant="ghost" className="w-full justify-center group-data-[collapsible=icon]:p-0" onClick={handleLogout}>
                    <LogOut />
                    <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">Logout</span>
                </Button>
            ) : (
                <Button variant="ghost" className="w-full justify-center group-data-[collapsible=icon]:p-0" onClick={() => router.push('/login')}>
                    <LogIn />
                    <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">Login / Sign Up</span>
                </Button>
            )}
            <SidebarTrigger className="hidden md:flex w-full" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="h-screen flex flex-col items-stretch">
            <div className="md:hidden flex items-center p-2 border-b shrink-0 bg-card">
               <SidebarTrigger />
            </div>
            <main className="flex-grow flex justify-center items-stretch w-full min-h-0">
              {activeSession ? (
                  <ChatContainer
                      key={activeSession.id}
                      session={activeSession}
                      onSessionUpdate={updateSession}
                  />
              ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                      <Bot size={48} className="text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Select a chat or start a new one.</p>
                  </div>
              )}
            </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
