
"use client";

import { useState, useEffect, useRef } from 'react';
import { Bot, MessageSquarePlus, Trash2, Pencil, LogIn, LogOut, PanelLeft, X } from 'lucide-react';
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
  SheetClose
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
import { CardTitle } from '@/components/ui/card';

const GUEST_SESSIONS_KEY = 'infinitus_guest_sessions';
const ACTIVE_GUEST_SESSION_ID_KEY = 'infinitus_active_guest_session_id';

export default function Home() {
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
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat',
      messages: [
        {
          id: 'init',
          role: 'assistant',
          content: 'Hello! Ask me anything, or upload a document to ask questions about it.',
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
                setActiveSessionId(null);
                 createNewSession();
            }
        }
        if (newSessions.length === 0) {
            createNewSession();
        }
        return newSessions;
    });
  }

  const clearActiveChat = () => {
    if (activeSessionId) {
      updateSession(activeSessionId, {
        messages: [{
          id: 'init',
          role: 'assistant',
          content: 'Hello! Ask me anything, or upload a document to ask questions about it.',
        }],
        document: null,
      });
    }
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
      setSessions([]);
      setActiveSessionId(null);
      toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
      });
      // After logout, the user becomes a guest, so we need to initialize a new guest session.
      const guestSessionsKey = GUEST_SESSIONS_KEY;
      const guestActiveIdKey = ACTIVE_GUEST_SESSION_ID_KEY;
      localStorage.removeItem(guestSessionsKey);
      localStorage.removeItem(guestActiveIdKey);
      
      router.push('/login');

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
        <SidebarHeader>
           <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center h-8" onClick={createNewSession}>
            <MessageSquarePlus />
            <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:ml-0 ml-2">New Chat</span>
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {sessions.map((session) => (
              <SidebarMenuItem key={session.id}>
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
                    className="truncate justify-start"
                  >
                    {session.title}
                  </SidebarMenuButton>
                )}
                 <div className="flex items-center">
                    {editingSessionId !== session.id && (
                        <SidebarMenuAction showOnHover onClick={() => handleStartEdit(session)}>
                            <Pencil />
                        </SidebarMenuAction>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <SidebarMenuAction showOnHover>
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
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            {user ? (
                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                    <LogOut className="mr-2" />
                    <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:ml-0 ml-2">Logout</span>
                </Button>
            ) : (
                <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/login')}>
                    <LogIn className="mr-2" />
                    <span className="duration-200 transition-opacity ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:ml-0 ml-2">Login / Sign Up</span>
                </Button>
            )}
            <SidebarTrigger className="ml-auto" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="h-screen flex flex-col">
            <main className="flex-grow p-4 flex justify-center items-center">
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
