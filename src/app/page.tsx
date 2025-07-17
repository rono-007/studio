
"use client";

import { useState, useEffect } from 'react';
import { Bot, MessageSquarePlus, Trash2 } from 'lucide-react';
import { ChatContainer, type ChatSession, type Message, type DocumentState } from '@/components/chat-container';
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
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
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

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedSessions = localStorage.getItem('parseai_sessions');
      const storedActiveId = localStorage.getItem('parseai_active_session_id');

      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions);
        setSessions(parsedSessions);
        
        if (storedActiveId && parsedSessions.some((s: ChatSession) => s.id === storedActiveId)) {
          setActiveSessionId(storedActiveId);
        } else if (parsedSessions.length > 0) {
          setActiveSessionId(parsedSessions[0].id);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    } catch (error) {
      console.error("Failed to load sessions from localStorage", error);
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if(isClient && sessions.length > 0) {
        try {
            localStorage.setItem('parseai_sessions', JSON.stringify(sessions));
        } catch (error) {
            console.error("Failed to save sessions to localStorage", error);
        }
    }
    if (isClient && activeSessionId) {
        try {
            localStorage.setItem('parseai_active_session_id', activeSessionId);
        } catch (error) {
             console.error("Failed to save active session ID to localStorage", error);
        }
    }
  }, [sessions, activeSessionId, isClient]);

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
                createNewSession();
            }
        }
        if (newSessions.length === 0) {
            localStorage.removeItem('parseai_sessions');
            localStorage.removeItem('parseai_active_session_id');
        }
        return newSessions;
    });
  }

  const activeSession = sessions.find(s => s.id === activeSessionId);
  
  if (!isClient) {
    return null; 
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
                <SidebarMenuButton
                  onClick={() => setActiveSessionId(session.id)}
                  isActive={session.id === activeSessionId}
                  className="truncate"
                >
                  {session.title}
                </SidebarMenuButton>
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
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if needed */}
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
                    <p>Select a chat or start a new one.</p>
                </div>
            )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
