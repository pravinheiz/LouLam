"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getOptimizedImageUrl } from "@/lib/image-utils";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  ShieldCheck,
  Building,
  Search,
  Compass,
  ExternalLink,
  Clock,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Check,
  CheckCheck
} from "lucide-react";

interface Participant {
  id: string;
  name: string | null;
  image: string | null;
  isVerified: boolean;
}

interface PropertyContext {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
}

interface Conversation {
  messageId: string;
  content: string;
  status: string;
  createdAt: string;
  senderId: string;
  receiverId: string;
  propertyId: string | null;
  otherParticipant: Participant;
  property: PropertyContext | null;
  isDraft?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  propertyId: string | null;
  content: string;
  status: string;
  createdAt: string;
}

function MessageStatusTicks({ status, className = "" }: { status: string; className?: string }) {
  if (status === "READ") {
    return <CheckCheck className={`h-3.5 w-3.5 text-sky-500 ${className}`} />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 ${className}`} />;
  }
  // Default to SENT
  return <Check className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 ${className}`} />;
}

function ChatWorkspace() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Params from query url
  const queryPropertyId = searchParams.get("propertyId");
  const queryReceiverId = searchParams.get("receiverId");

  // State managers
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Responsive state for mobile (list view vs workspace view)
  const [mobileWorkspaceActive, setMobileWorkspaceActive] = useState(false);

  // References for polling and auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedAtRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const threadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format currency helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format dates relative helper
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // Scroll viewport helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Fetch threads / conversation list
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingThreads(true);
    try {
      const response = await fetch("/api/chat/conversations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch conversations");

      const list: Conversation[] = data.data || [];
      setConversations(list);

      // If we have query parameters, check if we need to inject a draft thread
      if (queryReceiverId && status === "authenticated" && session?.user?.id) {
        const match = list.find(
          (c) =>
            c.otherParticipant.id === queryReceiverId &&
            c.propertyId === (queryPropertyId || null)
        );

        if (match) {
          if (!activeConversation) {
            setActiveConversation(match);
            if (!silent) setMobileWorkspaceActive(true);
          }
        } else if (!silent) {
          // Fetch property details to formulate a beautiful draft card
          let propDetails: PropertyContext | null = null;
          let otherDetails: Participant = {
            id: queryReceiverId,
            name: "Contacting Seller...",
            image: null,
            isVerified: false,
          };

          if (queryPropertyId) {
            try {
              const res = await fetch(`/api/listings/${queryPropertyId}`);
              const pData = await res.json();
              if (res.ok && pData.data) {
                propDetails = {
                  id: pData.data.id,
                  title: pData.data.title,
                  price: pData.data.price,
                  imageUrl: pData.data.images?.[0] || null,
                };
                otherDetails = {
                  id: pData.data.owner?.id || queryReceiverId,
                  name: pData.data.owner?.name || "Verified Seller",
                  image: pData.data.owner?.image || null,
                  isVerified: pData.data.owner?.sellerVerification?.status === "APPROVED",
                };
              }
            } catch (err) {
              console.error("Failed to load draft property context", err);
            }
          }

          const draftThread: Conversation = {
            messageId: "draft-msg",
            content: "Draft conversation",
            status: "SENT",
            createdAt: new Date().toISOString(),
            senderId: session.user.id,
            receiverId: queryReceiverId,
            propertyId: queryPropertyId || null,
            otherParticipant: otherDetails,
            property: propDetails,
            isDraft: true,
          };

          setConversations((prev) => {
            const hasDraft = prev.some((c) => c.isDraft);
            return hasDraft ? prev : [draftThread, ...prev];
          });
          setActiveConversation(draftThread);
          setMobileWorkspaceActive(true);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch conversations");
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  }, [queryPropertyId, queryReceiverId, activeConversation, session?.user?.id, status]);

  // Fetch detailed chat message logs
  const fetchMessages = useCallback(async (silent = false) => {
    if (!activeConversation) return;
    if (activeConversation.isDraft) {
      setMessages([]);
      return;
    }

    if (!silent) setLoadingMessages(true);
    try {
      const since = lastFetchedAtRef.current;
      const url = `/api/chat/messages?otherId=${activeConversation.otherParticipant.id}${
        activeConversation.propertyId ? `&propertyId=${activeConversation.propertyId}` : ""
      }${since ? `&since=${encodeURIComponent(since)}` : ""}`;

      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch messages");

      const newMsgs: Message[] = data.data || [];

      if (newMsgs.length > 0) {
        setMessages((prev) => {
          // If polling with since, append. Otherwise overwrite (full load)
          if (since) {
            const existingIds = new Set(prev.map((m) => m.id));
            const filteredNew = newMsgs.filter((m) => !existingIds.has(m.id));
            return [...prev, ...filteredNew];
          }
          return newMsgs;
        });

        // Update latest message fetch checkpoint
        const latest = newMsgs[newMsgs.length - 1];
        lastFetchedAtRef.current = latest.createdAt;
        
        // Auto scroll viewport
        setTimeout(() => scrollToBottom(since ? "smooth" : "auto"), 100);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [activeConversation]);

  // Send a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || sending) return;

    try {
      setSending(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activeConversation.otherParticipant.id,
          propertyId: activeConversation.propertyId,
          content: inputText.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to send message");

      const sentMsg: Message = data.data;

      // Append immediately to visual state
      setMessages((prev) => [...prev, sentMsg]);
      lastFetchedAtRef.current = sentMsg.createdAt;
      setInputText("");
      setTimeout(() => scrollToBottom("smooth"), 100);

      // If active thread was a draft, promote it to a regular thread
      if (activeConversation.isDraft) {
        const promoted: Conversation = {
          ...activeConversation,
          messageId: sentMsg.id,
          content: sentMsg.content,
          status: sentMsg.status,
          createdAt: sentMsg.createdAt,
          isDraft: false,
        };
        setActiveConversation(promoted);
        // Clear URL search params without reloading
        router.replace("/chat");
      }

      // Re-trigger threads lookup to update left side summaries
      fetchConversations(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deliver message. Try again.");
    } finally {
      setSending(false);
    }
  };

  // Select a conversation thread
  const handleSelectThread = (thread: Conversation) => {
    setActiveConversation(thread);
    setMessages([]);
    lastFetchedAtRef.current = null;
    setMobileWorkspaceActive(true);
  };

  // Initial load trigger
  useEffect(() => {
    if (status === "authenticated") {
      fetchConversations();
    }
  }, [status, fetchConversations]);

  // Messages loader effect hook
  useEffect(() => {
    if (activeConversation) {
      fetchMessages();
    }
  }, [activeConversation, fetchMessages]);

  // Realtime Polling setup (Interval Loops)
  useEffect(() => {
    if (activeConversation && !activeConversation.isDraft) {
      pollIntervalRef.current = setInterval(() => {
        fetchMessages(true);
      }, 3000); // Poll every 3 seconds for messages
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeConversation, fetchMessages]);

  useEffect(() => {
    if (status === "authenticated") {
      threadIntervalRef.current = setInterval(() => {
        fetchConversations(true);
      }, 6000); // Poll every 6 seconds for thread updates
    }

    return () => {
      if (threadIntervalRef.current) clearInterval(threadIntervalRef.current);
    };
  }, [status, fetchConversations]);

  // Tab visibility changes: pause polling when page is backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (threadIntervalRef.current) clearInterval(threadIntervalRef.current);
      } else {
        if (activeConversation && !activeConversation.isDraft) {
          pollIntervalRef.current = setInterval(() => fetchMessages(true), 3000);
        }
        if (status === "authenticated") {
          threadIntervalRef.current = setInterval(() => fetchConversations(true), 6000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeConversation, status, fetchMessages, fetchConversations]);

  // Filter conversations based on input search keyword
  const filteredThreads = conversations.filter((c) => {
    const nameMatch = (c.otherParticipant.name || "Anonymous").toLowerCase().includes(searchTerm.toLowerCase());
    const propertyMatch = c.property?.title.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const msgMatch = c.content.toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || propertyMatch || msgMatch;
  });

  // Auth Guard Screen
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-slate-400 dark:text-slate-500 font-semibold mt-4">Loading messaging portal...</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-lg space-y-6">
          <div className="mx-auto w-16 h-16 bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Authentication Required</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Please sign in to your account to access negotiations and view contact message threads.
            </p>
          </div>
          <Link
            href="/login"
            className="block w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Sign In to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 h-16 flex items-center shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-1.5 rounded-lg text-white">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:inline">
              HEISNAM ESTATE
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6 overflow-hidden max-h-[calc(100vh-5.5rem)]">
        
        {/* Thread List Sidebar */}
        <div className={`w-full lg:w-[350px] flex-shrink-0 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-sm transition-all duration-300 ${
          mobileWorkspaceActive ? "hidden lg:flex" : "flex"
        }`}>
          {/* Sidebar Search Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 space-y-4">
            <h1 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">Inbox</h1>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:border-indigo-500/60 dark:focus:border-indigo-400/50 transition-colors"
              />
            </div>
          </div>

          {/* Threads scrolling Container */}
          <div className="flex-grow overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-2 space-y-1 scrollbar-thin">
            {error && (
              <div className="p-3 mb-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-2xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {loadingThreads ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Syncing threads...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-medium">
                No active conversations found.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = activeConversation?.otherParticipant.id === thread.otherParticipant.id &&
                                activeConversation?.propertyId === thread.propertyId;
                const isUnread = thread.senderId !== session?.user?.id && thread.status !== "READ" && !thread.isDraft;
                
                return (
                  <button
                    key={`${thread.otherParticipant.id}-${thread.propertyId || "generic"}`}
                    onClick={() => handleSelectThread(thread)}
                    className={`w-full text-left p-3.5 rounded-2xl flex gap-3 transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/20"
                        : isUnread
                          ? "bg-slate-100/50 dark:bg-slate-800/40 border border-emerald-500/20 dark:border-emerald-500/10"
                          : "hover:bg-slate-50 dark:hover:bg-slate-850/40 border border-transparent"
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="relative w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0 flex items-center justify-center border border-slate-200/30 dark:border-slate-700/30">
                      {thread.otherParticipant.image ? (
                        <Image
                          src={getOptimizedImageUrl(thread.otherParticipant.image, "q_auto,f_auto,w_80,h_80,c_fill")}
                          alt={thread.otherParticipant.name || "Recipient"}
                          fill
                          className="object-cover rounded-xl"
                          sizes="44px"
                        />
                      ) : (
                        <span className="font-extrabold text-sm text-indigo-600">
                          {(thread.otherParticipant.name || "A")[0].toUpperCase()}
                        </span>
                      )}
                      {isUnread && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shrink-0" />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex-grow overflow-hidden space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`text-xs truncate ${
                            isUnread 
                              ? "font-black text-slate-900 dark:text-white" 
                              : "font-extrabold text-slate-900 dark:text-slate-200"
                          }`}>
                            {thread.otherParticipant.name || "Anonymous"}
                          </span>
                          {thread.otherParticipant.isVerified && (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                          )}
                        </div>
                        <span className={`text-[9px] font-bold shrink-0 ${
                          isUnread ? "text-emerald-500 font-extrabold" : "text-slate-400"
                        }`}>
                          {formatRelativeTime(thread.createdAt)}
                        </span>
                      </div>

                      {/* Property badge context */}
                      {thread.property && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 py-0.5 px-2 rounded-md max-w-fit truncate">
                          <Building className="h-3 w-3 shrink-0" />
                          <span>{thread.property.title}</span>
                        </div>
                      )}

                      {/* Message preview snippet */}
                      <div className="flex items-center gap-1 min-w-0">
                        {thread.senderId === session?.user?.id && !thread.isDraft && (
                          <MessageStatusTicks status={thread.status} className="shrink-0 scale-90" />
                        )}
                        <p className={`text-[11px] truncate flex-grow ${
                          isUnread
                            ? "font-bold text-slate-900 dark:text-white"
                            : isActive 
                              ? "text-indigo-900/80 dark:text-indigo-300" 
                              : "text-slate-450 dark:text-slate-400"
                        }`}>
                          {thread.isDraft ? "Draft conversation..." : thread.content}
                        </p>
                        {isUnread && (
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm shrink-0">
                            1
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Pane Workspace */}
        <div className={`flex-grow bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-sm ${
          !mobileWorkspaceActive ? "hidden lg:flex" : "flex"
        }`}>
          {activeConversation ? (
            <>
              {/* Header recipent metadata bar */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setMobileWorkspaceActive(false)}
                    className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 rounded-xl text-slate-500 lg:hidden cursor-pointer shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  <div className="relative w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    {activeConversation.otherParticipant.image ? (
                      <Image
                        src={getOptimizedImageUrl(activeConversation.otherParticipant.image, "q_auto,f_auto,w_80,h_80,c_fill")}
                        alt={activeConversation.otherParticipant.name || "Recipient"}
                        fill
                        className="object-cover rounded-xl"
                        sizes="40px"
                      />
                    ) : (
                      <span className="font-extrabold text-sm text-indigo-600">
                        {(activeConversation.otherParticipant.name || "A")[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden space-y-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <h2 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {activeConversation.otherParticipant.name || "Anonymous"}
                      </h2>
                      {activeConversation.otherParticipant.isVerified && (
                        <ShieldCheck className="h-4 w-4 text-emerald-500 fill-emerald-500/10 shrink-0" />
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                      Negotiator / Seller
                    </span>
                  </div>
                </div>

                {/* Main page details redirection */}
                <div className="flex items-center gap-2">
                  {activeConversation.propertyId && (
                    <Link
                      href={`/listings/${activeConversation.propertyId}`}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <span>View Listing</span>
                      <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Collapsible Linked Property Context details Card */}
              {activeConversation.property && (
                <div className="px-4 py-3 bg-indigo-50/30 dark:bg-indigo-950/10 border-b border-indigo-100/30 dark:border-indigo-900/10 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-9 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-200/20">
                      {activeConversation.property.imageUrl ? (
                        <Image
                          src={getOptimizedImageUrl(activeConversation.property.imageUrl, "q_auto,f_auto,w_100,h_80,c_fill")}
                          alt={activeConversation.property.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500">
                          <Building className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-1">
                        {activeConversation.property.title}
                      </h4>
                      <span className="font-black text-xs text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {formatPrice(activeConversation.property.price)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Message History Scroller panel */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Syncing historical logs...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Start the Negotiation</h4>
                      <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                        Send a message to introduce yourself and start discussing valuation, site viewings, or property specifications.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOutgoing = message.senderId === session?.user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col max-w-[75%] sm:max-w-[65%] space-y-1 ${
                          isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        {/* Chat bubble element */}
                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium ${
                            isOutgoing
                              ? "bg-indigo-600 text-white rounded-tr-none shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/20 dark:border-transparent"
                          }`}
                        >
                          <p className="break-words whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {/* Time stamp */}
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                          <Clock className="h-3 w-3 text-slate-300 dark:text-slate-700" />
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOutgoing && (
                            <MessageStatusTicks status={message.status} className="ml-1 shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message send Input bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-slate-100 dark:border-slate-800/60 flex items-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50"
              >
                <textarea
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  rows={1}
                  className="flex-grow resize-none max-h-24 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500/60 dark:focus:border-indigo-400/50 transition-colors"
                />
                
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:scale-100 shrink-0 cursor-pointer"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </>
          ) : (
            // Idle selection banner
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/40 text-slate-350 dark:text-slate-600 rounded-3xl flex items-center justify-center border border-slate-100 dark:border-slate-800/60">
                <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Your Negotiation Inbox</h3>
                <p className="text-slate-450 dark:text-slate-400 text-xs max-w-xs leading-relaxed">
                  Select an active negotiation from the sidebar threads or contact a seller on a listing page to begin direct messaging.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-slate-400 dark:text-slate-500 font-semibold mt-4">Loading messaging portal...</span>
      </div>
    }>
      <ChatWorkspace />
    </Suspense>
  );
}
