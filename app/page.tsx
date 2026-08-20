"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  Settings,
  LogOut,
  User as UserIcon,
  Send,
  Square as StopIcon,
  Paperclip,
  X,
  Volume2,
  Mic,
  Sun,
  Moon,
  Sparkles,
  Layers,
  Copy,
  RefreshCw,
  Menu,
  Zap,
  Code2,
  Lightbulb,
  FileText,
  Terminal,
  ChevronDown,
  Check,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { AuthModal } from "@/components/AuthModal";
import { SettingsModal } from "@/components/SettingsModal";
import { WorkspacePanel } from "@/components/WorkspacePanel";

type Theme = "dark" | "light";
type AccentTheme = "cyan" | "violet" | "emerald";
type Persona = "helper" | "coder" | "writer" | "analyst";
type AIModelMode = "fast" | "thinking" | "deep";
type TaskMode = "default" | "explain" | "rewrite";

type Message = {
  id: string;
  conversation_id: string;
  user_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  created_at: string;
  isStreaming?: boolean;
};

type ConversationSummary = {
  id: string;
  title: string;
  pinned: number;
  archived: number;
  project_id: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
};

type Project = {
  id: string;
  name: string;
  color: string;
};

type Note = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
};

type TaskItem = {
  id: string;
  title: string;
  done: number;
};

type ModelOption = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  content?: string;
};

export default function ZeroGenApp() {
  // Authentication & User state
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Appearance & Preferences
  const [theme, setTheme] = useState<Theme>("dark");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("cyan");
  const [compactMode, setCompactMode] = useState(false);
  const [persona, setPersona] = useState<Persona>("helper");
  const [aiMode, setAiMode] = useState<AIModelMode>("fast");
  const [taskMode, setTaskMode] = useState<TaskMode>("default");
  const [systemPrompt, setSystemPrompt] = useState("You are ZeroGen, a practical and thoughtful AI assistant.");
  const [useMemory, setUseMemory] = useState(true);
  const [memory, setMemory] = useState("No saved memory yet.");

  // Models & Streaming
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("zerogen-fast");
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);

  // Conversations & Chat
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeProjectFilter, setActiveProjectFilter] = useState("all");

  // Workspace Hub
  const [projects, setProjects] = useState<Project[]>([{ id: "general", name: "General", color: "cyan" }]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Panels & UI
  const [activePanel, setActivePanel] = useState<"chat" | "workspace">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isModelDropdownOpen]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  };

  // Accent styling mappings
  const accent = useMemo(() => {
    switch (accentTheme) {
      case "violet":
        return {
          primary: "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/20",
          text: "text-violet-400",
          border: "border-violet-500/40",
          activeBg: "bg-violet-500/15 text-violet-300 border-violet-500/40",
          glow: "rgba(168, 85, 247, 0.2)",
        };
      case "emerald":
        return {
          primary: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20",
          text: "text-emerald-400",
          border: "border-emerald-500/40",
          activeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
          glow: "rgba(16, 185, 129, 0.2)",
        };
      case "cyan":
      default:
        return {
          primary: "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20",
          text: "text-cyan-400",
          border: "border-cyan-500/40",
          activeBg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
          glow: "rgba(34, 211, 238, 0.2)",
        };
    }
  }, [accentTheme]);

  // 1. Initial Load: Check Auth, Models, Workspace
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load verified models from backend
        const modelsRes = await fetch("/api/models");
        if (modelsRes.ok) {
          const mData = await modelsRes.json();
          if (mData.models?.length) {
            setModels(mData.models);
            const defaultM = mData.models.find((m: ModelOption) => (m as any).isDefault)?.id || mData.models[0].id;
            setSelectedModel(defaultM);
          }
        }

        // Check Auth session
        const authRes = await fetch("/api/auth/me");
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.authenticated && authData.user) {
            setUser(authData.user);
            if (authData.settings) {
              setTheme(authData.settings.theme || "dark");
              setAccentTheme(authData.settings.accent_theme || "cyan");
              setPersona(authData.settings.persona || "helper");
              setAiMode(authData.settings.ai_mode || "fast");
              setTaskMode(authData.settings.task_mode || "default");
              setSystemPrompt(authData.settings.system_prompt || "You are ZeroGen, a practical and thoughtful AI assistant.");
              setCompactMode(Boolean(authData.settings.compact_mode));
              setUseMemory(Boolean(authData.settings.use_memory));
              setMemory(authData.settings.memory || "No saved memory yet.");
            }
            await loadConversationsAndWorkspace();
          }
        }
      } catch (err) {
        console.error("[init] App initialization error:", err);
      } finally {
        setAuthChecked(true);
      }
    };

    void initApp();
  }, []);

  // 2. Load conversations and workspace data
  const loadConversationsAndWorkspace = async () => {
    try {
      const [convRes, wsRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch("/api/workspace"),
      ]);

      if (convRes.ok) {
        const cData = await convRes.json();
        const convList: ConversationSummary[] = cData.conversations || [];
        setConversations(convList);

        if (convList.length > 0) {
          const firstId = convList[0].id;
          setCurrentChatId(firstId);
          await loadMessagesForChat(firstId);
        }
      }

      if (wsRes.ok) {
        const wData = await wsRes.json();
        if (wData.projects?.length) setProjects(wData.projects);
        if (wData.notes) setNotes(wData.notes);
        if (wData.tasks) setTasks(wData.tasks);
      }
    } catch (err) {
      console.error("[loadData] Error loading conversations/workspace:", err);
    }
  };

  // 3. Load messages for a single conversation
  const loadMessagesForChat = async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversation?.messages) {
          setMessages(data.conversation.messages);
        }
      }
    } catch (err) {
      console.error("[loadMessages] Error:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Switch chat
  const handleSelectChat = async (chatId: string) => {
    if (isGenerating) {
      handleStopGeneration();
    }
    setCurrentChatId(chatId);
    setSidebarOpen(false);
    await loadMessagesForChat(chatId);
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        void handleNewChat();
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setTheme((t) => (t === "dark" ? "light" : "dark"));
        showToast("Theme toggled");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user]);

  // Create New Chat
  const handleNewChat = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (isGenerating) {
      handleStopGeneration();
    }

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Conversation",
          projectId: activeProjectFilter === "all" ? "general" : activeProjectFilter,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newConv: ConversationSummary = data.conversation;
        setConversations((prev) => [newConv, ...prev]);
        setCurrentChatId(newConv.id);
        await loadMessagesForChat(newConv.id);
        setInputMessage("");
        setAttachments([]);
        if (composerRef.current) composerRef.current.style.height = "auto";
        setActivePanel("chat");
        setSidebarOpen(false);
        showToast("New chat started");
      }
    } catch (err) {
      console.error("[newChat] Error:", err);
      showToast("Failed to create new chat");
    }
  };

  // Rename Chat
  const handleRenameChat = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingTitleId(null);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
        );
        setEditingTitleId(null);
        showToast("Conversation renamed");
      }
    } catch (err) {
      console.error("[rename] Error:", err);
      showToast("Rename failed");
    }
  };

  // Toggle Pin Chat
  const handleTogglePin = async (id: string, currentPinned: number) => {
    try {
      const nextPinned = currentPinned === 1 ? false : true;
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });

      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, pinned: nextPinned ? 1 : 0 } : c))
        );
        showToast(nextPinned ? "Conversation pinned" : "Conversation unpinned");
      }
    } catch (err) {
      console.error("[pin] Error:", err);
    }
  };

  // Delete Chat
  const handleDeleteChat = async (id: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);

        if (currentChatId === id) {
          if (remaining.length > 0) {
            setCurrentChatId(remaining[0].id);
            await loadMessagesForChat(remaining[0].id);
          } else {
            await handleNewChat();
          }
        }
        showToast("Conversation deleted");
      }
    } catch (err) {
      console.error("[delete] Error:", err);
      showToast("Failed to delete conversation");
    }
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
    showToast("Generation stopped");
  };

  // Send Message with Real Streaming
  const handleSendMessage = async (customText?: string, isRetry = false) => {
    const text = (customText ?? inputMessage).trim();
    if ((!text && !attachments.length) || isGenerating) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    let activeId = currentChatId;
    if (!activeId) {
      await handleNewChat();
      return;
    }

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Optimistically update UI
    const tempUserMsgId = `temp_user_${Date.now()}`;
    const tempAssistantMsgId = `temp_asst_${Date.now() + 1}`;

    const userMessageObj: Message = {
      id: tempUserMsgId,
      conversation_id: activeId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    const assistantPlaceholderObj: Message = {
      id: tempAssistantMsgId,
      conversation_id: activeId,
      role: "assistant",
      content: "",
      isStreaming: true,
      created_at: new Date().toISOString(),
    };

    if (!isRetry) {
      setMessages((prev) => [...prev, userMessageObj, assistantPlaceholderObj]);
      setInputMessage("");
      setAttachments([]);
      if (composerRef.current) {
        composerRef.current.style.height = "auto";
      }
    } else {
      setMessages((prev) => [...prev, assistantPlaceholderObj]);
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: activeId,
          message: text,
          model: selectedModel,
          persona,
          mode: aiMode,
          taskMode,
          systemPrompt,
          useMemory,
          memory,
          attachments,
          isRetry,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      // Read real streaming stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedAccumulator = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamedAccumulator += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantMsgId
              ? { ...msg, content: streamedAccumulator, isStreaming: true }
              : msg
          )
        );
      }

      // Finalize assistant message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantMsgId
            ? { ...msg, content: streamedAccumulator, isStreaming: false }
            : msg
        )
      );

      // Refresh conversations list to show updated title and timestamp
      const convsRes = await fetch("/api/conversations");
      if (convsRes.ok) {
        const cData = await convsRes.json();
        setConversations(cData.conversations || []);
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantMsgId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      } else {
        console.error("[chat] Streaming error:", err);
        const errMsg = err instanceof Error ? err.message : "Failed to receive response";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantMsgId
              ? {
                  ...msg,
                  content: `ZeroGen encountered an error: ${errMsg}. Please check your connection or model settings.`,
                  isStreaming: false,
                }
              : msg
          )
        );
        showToast("Error generating response");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate Response
  const handleRegenerate = async () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;
    await handleSendMessage(lastUserMessage.content, true);
  };

  // Edit and Resend User Message
  const handleEditMessage = async (messageId: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;

    const newContent = window.prompt("Edit your message:", target.content);
    if (!newContent || newContent.trim() === target.content.trim()) return;

    if (!currentChatId) return;

    try {
      await fetch(`/api/conversations/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: newContent.trim(),
          deleteAfterMessageId: messageId,
        }),
      });

      await loadMessagesForChat(currentChatId);
      await handleSendMessage(newContent.trim(), true);
    } catch (err) {
      console.error("[editMessage] Error:", err);
    }
  };

  // File Attachments
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isText = file.type.startsWith("text/") || file.name.endsWith(".ts") || file.name.endsWith(".tsx") || file.name.endsWith(".js") || file.name.endsWith(".py") || file.name.endsWith(".json") || file.name.endsWith(".md") || file.name.endsWith(".css") || file.name.endsWith(".html");

      if (isText) {
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              type: file.type || "text/plain",
              size: `${(file.size / 1024).toFixed(1)} KB`,
              content: content.slice(0, 10000),
            },
          ]);
        };
        reader.readAsText(file);
      } else {
        setAttachments((prev) => [
          ...prev,
          {
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            type: file.type || "file",
            size: `${(file.size / 1024).toFixed(1)} KB`,
          },
        ]);
      }
    });

    showToast(`${files.length} file(s) attached`);
    e.target.value = "";
  };

  // Voice Dictation (Web Speech API)
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported in this browser");
      return;
    }

    if (voiceListening && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      setVoiceListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript || "")
        .join(" ");
      setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      showToast("Voice capture error");
    };

    recognition.onend = () => setVoiceListening(false);

    speechRecognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
    showToast("Listening...");
  };

  // Text-to-speech
  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    showToast("Reading aloud");
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setConversations([]);
      setMessages([]);
      setCurrentChatId(null);
      setSettingsOpen(false);
      setAuthModalOpen(true);
      showToast("Signed out");
    } catch (err) {
      console.error("[logout] Error:", err);
    }
  };

  // Update Settings
  const handleUpdateSettings = async (updates: any) => {
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "settings", data: updates }),
      });

      if (res.ok) {
        if (updates.theme) setTheme(updates.theme);
        if (updates.accent_theme) setAccentTheme(updates.accent_theme);
        if (updates.persona) setPersona(updates.persona);
        if (updates.ai_mode) setAiMode(updates.ai_mode);
        if (updates.task_mode) setTaskMode(updates.task_mode);
        if (updates.system_prompt) setSystemPrompt(updates.system_prompt);
        if (updates.compact_mode !== undefined) setCompactMode(Boolean(updates.compact_mode));
        if (updates.use_memory !== undefined) setUseMemory(Boolean(updates.use_memory));
        if (updates.memory) setMemory(updates.memory);
        showToast("Settings updated");
      }
    } catch (err) {
      console.error("[settings] Error:", err);
    }
  };

  // Workspace CRUD Handlers
  const handleCreateNote = async (title: string, content: string) => {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", data: { title, content } }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => [data.note, ...prev]);
      showToast("Note added");
    }
  };

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/workspace?type=note&id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast("Note removed");
    }
  };

  const handleCreateTask = async (title: string) => {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "task", data: { title } }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => [data.task, ...prev]);
      showToast("Task added");
    }
  };

  const handleToggleTask = async (id: string) => {
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "task_toggle", data: { id } }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    }
  };

  const handleDeleteTask = async (id: string) => {
    const res = await fetch(`/api/workspace?type=task&id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      showToast("Task removed");
    }
  };

  const handleCreateProject = async (name: string, color: string) => {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "project", data: { name, color } }),
    });
    if (res.ok) {
      const data = await res.json();
      setProjects((prev) => [...prev, data.project]);
      showToast(`Project created: ${name}`);
    }
  };

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const matchesSearch = !q || c.title.toLowerCase().includes(q) || (c.last_message && c.last_message.toLowerCase().includes(q));
      const matchesProj = activeProjectFilter === "all" || c.project_id === activeProjectFilter;
      return matchesSearch && matchesProj && !c.archived;
    });
  }, [conversations, searchQuery, activeProjectFilter]);

  const currentConversation = useMemo(() => {
    return conversations.find((c) => c.id === currentChatId);
  }, [conversations, currentChatId]);

  const selectedModelDisplayName = useMemo(() => {
    const found = models.find((m) => m.id === selectedModel);
    if (found) return found.name;
    if (selectedModel === "zerogen-fast") return "ZeroGen Fast";
    if (selectedModel === "zerogen-pro") return "ZeroGen Pro";
    if (selectedModel === "zerogen-ultra") return "ZeroGen Ultra";
    return "ZeroGen Fast";
  }, [models, selectedModel]);

  const surfaceClass = theme === "dark"
    ? "border-slate-800/80 bg-slate-900/70 text-slate-100 backdrop-blur-xl shadow-lg"
    : "border-slate-200/90 bg-white/80 text-slate-900 backdrop-blur-xl shadow-md";

  return (
    <main
      className={`relative flex h-screen w-full overflow-hidden transition-colors duration-300 ${
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Dynamic Background Mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute inset-0 ${
            theme === "dark"
              ? "bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.12),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.12),transparent_40%)]"
              : "bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(167,139,250,0.15),transparent_40%)]"
          }`}
        />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 rounded-2xl border border-cyan-500/40 bg-slate-900/90 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-2xl backdrop-blur-md"
        >
          {toastMessage}
        </motion.div>
      )}

      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR (Desktop & Mobile Drawer)                                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(sidebarOpen || (typeof window !== "undefined" && window.innerWidth >= 1024)) && (
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r lg:static lg:flex ${
              theme === "dark" ? "border-slate-800/80 bg-slate-950/95" : "border-slate-200/90 bg-white/95"
            } p-4 backdrop-blur-2xl transition-all duration-200 shadow-2xl lg:shadow-none`}
          >
            {/* Sidebar Header & Brand */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-500 shadow-md">
                  <Sparkles className="h-5 w-5 text-slate-950" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight">ZeroGen</h1>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">AI Assistant</p>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/60 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleNewChat}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 px-4 font-semibold text-sm transition shadow-sm ${accent.primary}`}
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>

            {/* Search Bar */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
            </div>

            {/* Project Filter Pills */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              <button
                onClick={() => setActiveProjectFilter("all")}
                className={`rounded-lg px-2.5 py-1 font-medium transition whitespace-nowrap ${
                  activeProjectFilter === "all"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProjectFilter(p.id)}
                  className={`rounded-lg px-2.5 py-1 font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                    activeProjectFilter === p.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        p.color === "violet" ? "#a855f7" : p.color === "emerald" ? "#10b981" : "#22d3ee",
                    }}
                  />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Conversation History List */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                Recent Chats
              </div>

              {filteredConversations.map((chat) => {
                const isActive = currentChatId === chat.id;
                const isEditingThis = editingTitleId === chat.id;

                return (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center justify-between rounded-xl border p-2.5 text-left transition cursor-pointer ${
                      isActive
                        ? `${accent.activeBg} font-medium`
                        : "border-transparent hover:border-slate-800/80 hover:bg-slate-900/40 text-slate-300"
                    }`}
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? accent.text : "text-slate-500"}`} />

                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editTitleValue}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleRenameChat(chat.id, editTitleValue);
                            } else if (e.key === "Escape") {
                              setEditingTitleId(null);
                            }
                          }}
                          onBlur={() => handleRenameChat(chat.id, editTitleValue)}
                          className="w-full bg-slate-950 px-1 py-0.5 text-xs text-white rounded border border-cyan-400 outline-none"
                        />
                      ) : (
                        <div className="overflow-hidden flex-1">
                          <p className="truncate text-xs font-medium leading-tight">{chat.title}</p>
                          {chat.last_message ? (
                            <p className="truncate text-[11px] text-slate-500 mt-0.5">{chat.last_message}</p>
                          ) : (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(chat.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTitleId(chat.id);
                          setEditTitleValue(chat.title);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Rename"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleTogglePin(chat.id, chat.pinned);
                        }}
                        className={`p-1 ${chat.pinned ? "text-cyan-400" : "text-slate-400 hover:text-white"}`}
                        title={chat.pinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="h-3 w-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteChat(chat.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredConversations.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  {searchQuery ? "No matching conversations" : "No conversations yet"}
                </div>
              )}
            </div>

            {/* User Profile & Settings Footer */}
            <div className="mt-auto border-t border-slate-800/80 pt-3">
              {user ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 font-bold text-xs shrink-0">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="truncate text-xs font-semibold">{user.name}</p>
                      <p className="truncate text-[10px] text-slate-400">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE & CHAT AREA                                                */}
      {/* ========================================================================= */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navigation Header */}
        <header
          className={`flex h-16 items-center justify-between border-b px-4 sm:px-6 backdrop-blur-xl z-20 ${
            theme === "dark" ? "border-slate-800/80 bg-slate-950/80" : "border-slate-200/90 bg-white/80"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-xl border border-slate-700/60 p-2 text-slate-300 hover:bg-slate-800/60 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="overflow-hidden">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Active Conversation</p>
              <h2 className="truncate text-sm sm:text-base font-bold">{currentConversation?.title || "New Conversation"}</h2>
            </div>
          </div>

          {/* Model Selector & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* ZeroGen Model Selector Dropdown Popover */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "border-slate-700/80 bg-slate-900/90 text-slate-100 hover:border-slate-600"
                    : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                }`}
                title="Select ZeroGen model tier"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>{selectedModelDisplayName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {isModelDropdownOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border p-2 shadow-2xl z-50 backdrop-blur-xl ${
                    theme === "dark" ? "border-slate-800 bg-slate-950/95 text-slate-100" : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ZeroGen Model Tiers
                  </div>
                  <div className="space-y-1">
                    {[
                      {
                        id: "zerogen-fast",
                        name: "ZeroGen Fast",
                        badge: "Fast",
                        desc: "Fast everyday responses",
                        badgeColor: "bg-cyan-500/15 text-cyan-300",
                      },
                      {
                        id: "zerogen-pro",
                        name: "ZeroGen Pro",
                        badge: "Pro",
                        desc: "Balanced performance for complex work",
                        badgeColor: "bg-violet-500/15 text-violet-300",
                      },
                      {
                        id: "zerogen-ultra",
                        name: "ZeroGen Ultra",
                        badge: "Ultra",
                        desc: "Maximum capability for demanding tasks",
                        badgeColor: "bg-emerald-500/15 text-emerald-300",
                      },
                    ].map((item) => {
                      const isSelected = selectedModel === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(item.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`flex w-full items-start justify-between rounded-xl p-2.5 text-left transition ${
                            isSelected
                              ? theme === "dark"
                                ? "bg-cyan-500/15 border border-cyan-500/30"
                                : "bg-cyan-50 border border-cyan-200"
                              : theme === "dark"
                              ? "hover:bg-slate-900 border border-transparent"
                              : "hover:bg-slate-100 border border-transparent"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold">{item.name}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Streaming Toggle */}
            <button
              type="button"
              onClick={() => setStreamingEnabled(!streamingEnabled)}
              className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                streamingEnabled
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700/70 bg-slate-900/60 text-slate-400"
              }`}
              title="Toggle token streaming"
            >
              <Zap className={`h-3 w-3 ${streamingEnabled ? "text-cyan-400 animate-pulse" : ""}`} />
              <span>{streamingEnabled ? "Streaming" : "Buffered"}</span>
            </button>

            {/* Workspace Hub Toggle */}
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === "chat" ? "workspace" : "chat")}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                activePanel === "workspace"
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700/70 bg-slate-900/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Workspace</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl border border-slate-700/60 p-2 text-slate-300 hover:bg-slate-800/60 transition"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl border border-slate-700/60 p-2 text-slate-300 hover:bg-slate-800/60 transition"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content View: Chat vs Workspace */}
        {activePanel === "workspace" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
            <WorkspacePanel
              projects={projects}
              notes={notes}
              tasks={tasks}
              onCreateNote={handleCreateNote}
              onDeleteNote={handleDeleteNote}
              onCreateTask={handleCreateTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onCreateProject={handleCreateProject}
              theme={theme}
              accentTheme={accentTheme}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
              <div className="mx-auto max-w-3xl space-y-4">
                {/* Welcome / Mode Banner */}
                <div className={`rounded-2xl border p-3.5 text-xs ${surfaceClass} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-semibold text-cyan-400">ZeroGen Live:</span>
                    <span className="text-slate-400 capitalize">
                      Persona: <strong className="text-white">{persona}</strong> • Mode:{" "}
                      <strong className="text-white">{aiMode}</strong> • Model:{" "}
                      <strong className="text-white">{selectedModelDisplayName}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Adjust
                  </button>
                </div>

                {/* Empty State Prompt Starter Cards (if chat is empty or fresh) */}
                {messages.length === 0 && !loadingMessages && (
                  <div className="py-10 text-center space-y-6">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-500 shadow-lg shadow-cyan-500/20">
                      <Sparkles className="h-7 w-7 text-slate-950" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight">How can ZeroGen assist you today?</h3>
                      <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                        Ask complex questions, write and debug code, design systems, or brainstorm ideas.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-left max-w-xl mx-auto pt-2">
                      <button
                        onClick={() => void handleSendMessage("Build a modern, responsive landing page in React.")}
                        className={`rounded-2xl border p-4 transition group text-left ${
                          theme === "dark"
                            ? "border-slate-800/90 bg-slate-900/60 hover:border-cyan-400/40 hover:bg-slate-900"
                            : "border-slate-200 bg-slate-50 hover:border-cyan-400 hover:bg-white shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-cyan-400 mb-1">
                          <Code2 className="h-4 w-4" />
                          <span className="text-xs font-bold">Build a landing page</span>
                        </div>
                        <p className="text-xs text-slate-400">Create a modern, responsive landing page in React</p>
                      </button>

                      <button
                        onClick={() => void handleSendMessage("Explain quantum computing with clear analogies.")}
                        className={`rounded-2xl border p-4 transition group text-left ${
                          theme === "dark"
                            ? "border-slate-800/90 bg-slate-900/60 hover:border-violet-400/40 hover:bg-slate-900"
                            : "border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-white shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-violet-400 mb-1">
                          <Lightbulb className="h-4 w-4" />
                          <span className="text-xs font-bold">Explain a difficult concept</span>
                        </div>
                        <p className="text-xs text-slate-400">Break down quantum computing with clear analogies</p>
                      </button>

                      <button
                        onClick={() => void handleSendMessage("Write and debug an efficient binary search algorithm.")}
                        className={`rounded-2xl border p-4 transition group text-left ${
                          theme === "dark"
                            ? "border-slate-800/90 bg-slate-900/60 hover:border-emerald-400/40 hover:bg-slate-900"
                            : "border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-white shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                          <Terminal className="h-4 w-4" />
                          <span className="text-xs font-bold">Write and debug code</span>
                        </div>
                        <p className="text-xs text-slate-400">Implement an efficient binary search algorithm</p>
                      </button>

                      <button
                        onClick={() => void handleSendMessage("Analyze the system architecture for a real-time service.")}
                        className={`rounded-2xl border p-4 transition group text-left ${
                          theme === "dark"
                            ? "border-slate-800/90 bg-slate-900/60 hover:border-cyan-400/40 hover:bg-slate-900"
                            : "border-slate-200 bg-slate-50 hover:border-cyan-400 hover:bg-white shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-cyan-400 mb-1">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs font-bold">Analyze an idea</span>
                        </div>
                        <p className="text-xs text-slate-400">Evaluate the system architecture for a real-time service</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Messages List */}
                {messages.map((msg) => {
                  const isAssistant = msg.role === "assistant";

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isAssistant ? "items-start" : "items-end"}`}
                    >
                      {/* Message Bubble */}
                      <div
                        className={`group relative rounded-3xl border ${
                          compactMode ? "p-3.5 text-xs" : "p-4 sm:p-5 text-sm"
                        } max-w-[95%] sm:max-w-[85%] shadow-md transition-all ${
                          isAssistant
                            ? theme === "dark"
                              ? "border-slate-800/90 bg-slate-900/80 text-slate-100"
                              : "border-slate-200 bg-white text-slate-900"
                            : theme === "dark"
                            ? "border-cyan-500/30 bg-cyan-950/40 text-cyan-100"
                            : "border-cyan-200 bg-cyan-50 text-cyan-950"
                        }`}
                      >
                        {/* Header metadata */}
                        <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          <span className={isAssistant ? "text-cyan-400" : "text-cyan-300"}>
                            {isAssistant ? "ZeroGen AI" : user?.name || "You"}
                          </span>
                          <span className="text-[10px] font-normal lowercase text-slate-500">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Message Content */}
                        {isAssistant ? (
                          msg.content ? (
                            <MarkdownRenderer content={msg.content} theme={theme} />
                          ) : msg.isStreaming ? (
                            <div className="flex items-center gap-2 py-2 text-slate-400">
                              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                              <span className="text-xs">ZeroGen is thinking...</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No response content</span>
                          )
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800/40 pt-2 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              showToast("Message copied to clipboard");
                            }}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                            title="Copy message text"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>

                          {isAssistant && (
                            <>
                              <button
                                onClick={() => handleSpeak(msg.content)}
                                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                                title="Read aloud"
                              >
                                <Volume2 className="h-3 w-3" />
                                <span>Read</span>
                              </button>

                              <button
                                onClick={handleRegenerate}
                                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                                title="Regenerate response"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Regenerate</span>
                              </button>
                            </>
                          )}

                          {!isAssistant && (
                            <button
                              onClick={() => handleEditMessage(msg.id)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                              title="Edit message"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer Footer Area */}
            <div
              className={`border-t p-3 sm:p-4 backdrop-blur-xl ${
                theme === "dark" ? "border-slate-800/80 bg-slate-950/80" : "border-slate-200/90 bg-white/80"
              }`}
            >
              <div className="mx-auto max-w-3xl space-y-2">
                {/* File Attachment Previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                      >
                        <Paperclip className="h-3 w-3 text-cyan-400" />
                        <span className="max-w-[150px] truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-500">({att.size})</span>
                        <button
                          onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                          className="text-slate-400 hover:text-white ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Prompts / Mode Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {(["Summarize", "Explain properly", "Give me code", "Draft execution plan"] as const).map(
                      (promptText) => (
                        <button
                          key={promptText}
                          type="button"
                          onClick={() => setInputMessage(promptText)}
                          className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2.5 py-0.5 text-[11px] text-slate-300 hover:border-cyan-400 hover:text-cyan-300 transition"
                        >
                          {promptText}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Main Composer Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendMessage();
                  }}
                  className={`relative flex flex-col rounded-3xl border p-2.5 sm:p-3 shadow-2xl transition-all ${
                    theme === "dark"
                      ? "border-slate-800 bg-slate-900/90 focus-within:border-cyan-400"
                      : "border-slate-300 bg-white focus-within:border-cyan-500"
                  }`}
                >
                  <textarea
                    ref={composerRef}
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Ask ZeroGen anything..."
                    rows={1}
                    className="min-h-[60px] max-h-[180px] w-full resize-none bg-transparent px-2 text-sm text-inherit placeholder-slate-500 outline-none"
                  />

                  {/* Actions toolbar */}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-800/40 pt-2">
                    <div className="flex items-center gap-1.5">
                      {/* Attachment upload */}
                      <label
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-300 transition"
                        title="Attach text or code file"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Attach</span>
                        <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                      </label>

                      {/* Voice Dictation */}
                      <button
                        type="button"
                        onClick={handleToggleVoice}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                          voiceListening
                            ? "border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse"
                            : "border-slate-700/70 bg-slate-800/50 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                        }`}
                        title="Dictate with voice"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{voiceListening ? "Listening..." : "Voice"}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isGenerating ? (
                        <button
                          type="button"
                          onClick={handleStopGeneration}
                          className="flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600 transition shadow-md"
                        >
                          <StopIcon className="h-3.5 w-3.5 fill-white" />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!inputMessage.trim() && attachments.length === 0}
                          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold transition shadow-md disabled:cursor-not-allowed disabled:opacity-40 ${accent.primary}`}
                        >
                          <span>Send</span>
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS                                                         */}
      {/* ========================================================================= */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          setAuthModalOpen(false);
          void loadConversationsAndWorkspace();
          showToast(`Welcome, ${newUser.name}!`);
        }}
        accentTheme={accentTheme}
        theme={theme}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        settings={{
          theme,
          accent_theme: accentTheme,
          persona,
          ai_mode: aiMode,
          task_mode: taskMode,
          system_prompt: systemPrompt,
          compact_mode: compactMode ? 1 : 0,
          use_memory: useMemory ? 1 : 0,
          memory,
        }}
        onUpdateSettings={handleUpdateSettings}
        onLogout={handleLogout}
      />
    </main>
  );
}