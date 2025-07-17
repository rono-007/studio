
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
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const GUEST_SESSIONS_KEY = 'parseai_guest_sessions';
const ACTIVE_GUEST_SESSION_ID_KEY = 'parseai_active_guest_session_id';

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

  const getSessionsKey = () => user ? `parseai_sessions_${user.uid}` : GUEST_SESSIONS_KEY;
  const getActiveSessionIdKey = () => user ? `parseai_active_session_id_${user.uid}` : ACTIVE_GUEST_SESSION_ID_KEY;

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
    const auth = getAuth();
    await signOut(auth);
    setSessions([]);
    setActiveSessionId(null);
    toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
    });
    // After logout, the user becomes a guest, so we need to initialize a new guest session.
    createNewSession();
    router.push('/');
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
           <Button variant="ghost" className="w-full justify-start" onClick={createNewSession}>
            <MessageSquarePlus className="mr-2" />
            New Chat
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
                    className="truncate"
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
                    Logout
                </Button>
            ) : (
                <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/login')}>
                    <LogIn className="mr-2" />
                    Sign Up
                </Button>
            )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <div className="flex min-h-screen items-center justify-center p-4">
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
