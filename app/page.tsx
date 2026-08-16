"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Theme = "dark" | "light";
type AccentTheme = "cyan" | "violet" | "emerald";
type Persona = "helper" | "critic" | "planner";
type AIModelMode = "fast" | "thinking" | "deep";
type TaskMode = "default" | "explain" | "rewrite";

type MessageRole = "user" | "assistant";

type Project = {
  id: string;
  name: string;
  color: AccentTheme;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type TaskItem = {
  id: string;
  title: string;
  done: boolean;
};

type InsightMetric = {
  label: string;
  value: string;
  detail: string;
};

type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
};

type PromptTemplate = {
  id: string;
  label: string;
  prompt: string;
};

type ImageResult = {
  id: number;
  prompt: string;
  url: string;
  style: string;
};

type Chat = {
  id: number;
  title: string;
  pinned: boolean;
  archived: boolean;
  projectId: string;
  messages: Message[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type Message = {
  id: number;
  role: MessageRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  attachments?: Attachment[];
};

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  preview: string;
};

type PersistedAppState = {
  theme: Theme;
  accentTheme: AccentTheme;
  compactMode: boolean;
  persona: Persona;
  aiMode: AIModelMode;
  taskMode: TaskMode;
  useMemory: boolean;
  memory: string;
  systemPrompt: string;
  chats: Chat[];
  currentChatId: number;
  projects: Project[];
  activeProjectFilter: string;
  notes: Note[];
  tasks: TaskItem[];
};

const STORAGE_KEY = "zerogen-app-state";

const loadPersistedState = (): Partial<PersistedAppState> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedAppState>) : null;
  } catch {
    return null;
  }
};

const persistState = (state: PersistedAppState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const promptTemplates: PromptTemplate[] = [
  { id: "summarize", label: "Summarize", prompt: "Summarize this idea in a concise, action-oriented format." },
  { id: "brainstorm", label: "Brainstorm", prompt: "Generate a handful of thoughtful options and explain the tradeoffs." },
  { id: "refactor", label: "Refactor", prompt: "Refactor this into a cleaner, more maintainable structure with short explanations." },
  { id: "plan", label: "Plan", prompt: "Turn this into a step-by-step execution plan with priorities and risks." },
];

const createMessage = (
  role: MessageRole,
  content: string,
  id = Date.now(),
  timestamp?: string
): Message => ({
  id,
  role,
  content,
  timestamp:
    timestamp ??
    (typeof window === "undefined"
      ? "Just now"
      : new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })),
});

const createChat = (
  id = Date.now(),
  title = "New Chat",
  projectId = "general",
  initialMessageTimestamp?: string
): Chat => ({
  id,
  title,
  pinned: false,
  archived: false,
  projectId,
  messages: [
    createMessage(
      "assistant",
      "Hello! I’m ZeroGen. Ask anything and I’ll help you summarize ideas, draft a plan, refactor code, or clean up what’s unnecessary.",
      id + 1,
      initialMessageTimestamp
    ),
  ],
});

function renderMessageContent(content: string) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        nodes.push(
          <pre
            key={`code-${index}`}
            className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-sm text-slate-100"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBuffer = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (!line.trim()) {
      nodes.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }

    nodes.push(
      <p key={`line-${index}`} className="whitespace-pre-wrap leading-7">
        {line}
      </p>
    );
  });

  if (inCodeBlock) {
    nodes.push(
      <pre
        key="code-final"
        className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-sm text-slate-100"
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
  }

  return nodes;
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("cyan");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready to chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [persona, setPersona] = useState<Persona>("helper");
  const [aiMode, setAiMode] = useState<AIModelMode>("fast");
  const [taskMode, setTaskMode] = useState<TaskMode>("default");
  const [useMemory, setUseMemory] = useState(true);
  const [memory, setMemory] = useState("No saved memory yet.");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are ZeroGen, a practical and thoughtful AI assistant."
  );
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("cinematic");
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(process.env.NEXT_PUBLIC_DEFAULT_MODEL ?? "gpt-4o-mini");
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "image" | "voice" | "settings" | "auth" | "workspace">("chat");
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [projects, setProjects] = useState<Project[]>([{ id: "general", name: "General", color: "cyan" }]);
  const [activeProjectFilter, setActiveProjectFilter] = useState("all");
  const [notes, setNotes] = useState<Note[]>([
    { id: "note-1", title: "Launch checklist", content: "Confirm onboarding flow, polish UI, and prepare the rollout note.", createdAt: "Today" },
  ]);
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: "task-1", title: "Refine onboarding copy", done: false },
    { id: "task-2", title: "Review prompt templates", done: true },
  ]);
  const [insightMetrics, setInsightMetrics] = useState<InsightMetric[]>([
    { label: "Active chats", value: "12", detail: "Across 3 projects" },
    { label: "Task completion", value: "68%", detail: "2 of 3 wrapped up" },
    { label: "Notes captured", value: "7", detail: "Recently updated" },
  ]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([
    { id: "timeline-1", title: "New project created", detail: "A fresh workspace project was added for the current sprint.", time: "10m ago" },
    { id: "timeline-2", title: "Prompt template used", detail: "A brainstorm prompt helped shape the next conversation.", time: "35m ago" },
    { id: "timeline-3", title: "Task marked complete", detail: "One follow-up item is now checked off and archived in the board.", time: "1h ago" },
  ]);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [chats, setChats] = useState<Chat[]>([createChat(1, "New Chat", "general", "Just now")]);
  const [currentChatId, setCurrentChatId] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const togglePanel = (panel: "chat" | "image" | "voice" | "settings" | "auth" | "workspace") => {
    setActivePanel((current) => (current === panel ? "chat" : panel));
  };
  const importChatInputRef = useRef<HTMLInputElement | null>(null);
  const stopRequestedRef = useRef(false);
  const toastTimeoutRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const currentChat = useMemo(
    () => chats.find((chat) => chat.id === currentChatId) ?? chats[0],
    [chats, currentChatId]
  );

  const filteredChats = useMemo(() => {
    const query = search.toLowerCase();
    return chats.filter((chat) => {
      const matchesQuery = chat.title.toLowerCase().includes(query);
      const matchesProject = activeProjectFilter === "all" || chat.projectId === activeProjectFilter;
      return matchesQuery && matchesProject && !chat.archived;
    });
  }, [chats, search, activeProjectFilter]);

  const accentClasses = useMemo(
    () => ({
      cyan: {
        chip: "text-cyan-400",
        button: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
        border: "border-cyan-500/40",
        active: "bg-cyan-500/15 text-cyan-300",
      },
      violet: {
        chip: "text-violet-400",
        button: "bg-violet-500 text-white hover:bg-violet-400",
        border: "border-violet-500/40",
        active: "bg-violet-500/15 text-violet-300",
      },
      emerald: {
        chip: "text-emerald-400",
        button: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
        border: "border-emerald-500/40",
        active: "bg-emerald-500/15 text-emerald-300",
      },
    }),
    []
  );

  const activeAccent = accentClasses[accentTheme];

  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted?.theme) setTheme(persisted.theme);
    if (persisted?.accentTheme) setAccentTheme(persisted.accentTheme);
    if (typeof persisted?.compactMode === "boolean") setCompactMode(persisted.compactMode);
    if (persisted?.persona) setPersona(persisted.persona);
    if (persisted?.aiMode) setAiMode(persisted.aiMode);
    if (persisted?.taskMode) setTaskMode(persisted.taskMode);
    if (typeof persisted?.useMemory === "boolean") setUseMemory(persisted.useMemory);
    if (persisted?.memory) setMemory(persisted.memory);
    if (persisted?.systemPrompt) setSystemPrompt(persisted.systemPrompt);
    if (persisted?.chats?.length) setChats(persisted.chats);
    if (persisted?.currentChatId) setCurrentChatId(persisted.currentChatId);
    if (persisted?.projects?.length) setProjects(persisted.projects);
    if (persisted?.activeProjectFilter) setActiveProjectFilter(persisted.activeProjectFilter);
    if (persisted?.notes?.length) setNotes(persisted.notes);
    if (persisted?.tasks?.length) setTasks(persisted.tasks);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  useEffect(() => {
    persistState({
      theme,
      accentTheme,
      compactMode,
      persona,
      aiMode,
      taskMode,
      useMemory,
      memory,
      systemPrompt,
      chats,
      currentChatId,
      projects,
      activeProjectFilter,
      notes,
      tasks,
    });
  }, [theme, accentTheme, compactMode, persona, aiMode, taskMode, useMemory, memory, systemPrompt, chats, currentChatId, projects, activeProjectFilter, notes, tasks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
        SpeechRecognition?: SpeechRecognitionConstructorLike;
      }
    ).webkitSpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructorLike }).SpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      const lastResult = results[results.length - 1];
      setVoiceTranscript(transcript);
      if (lastResult && lastResult[0]?.transcript) {
        setMessage((previous) => (previous ? `${previous} ${transcript}`.trim() : transcript));
        setListening(false);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      showToast("Voice capture failed");
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), 2200);
  };

  const insertTemplate = (template: string) => {
    setMessage((previous) => (previous ? `${previous}\n\n${template}` : template));
    composerRef.current?.focus();
    showToast("Template inserted");
  };

  const exportCurrentChat = () => {
    if (!currentChat) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      title: currentChat.title,
      messages: currentChat.messages.map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp,
        attachments: entry.attachments ?? [],
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentChat.title.replace(/\s+/g, "-").toLowerCase() || "chat"}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    showToast("Chat exported");
  };

  const shareCurrentChat = async () => {
    if (!currentChat) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      title: currentChat.title,
      messages: currentChat.messages.map((entry) => ({ id: entry.id, role: entry.role, content: entry.content, timestamp: entry.timestamp })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast("Chat JSON copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  const importChatFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        title?: string;
        messages?: Array<{
          id?: number;
          role?: string;
          content?: string;
          timestamp?: string;
          attachments?: Attachment[];
        }>;
      };

      const importedMessages = (parsed.messages ?? [])
        .filter((entry) => entry.role && entry.content)
        .map((entry, index) => ({
          id: entry.id ?? Date.now() + index,
          role: entry.role as MessageRole,
          content: entry.content ?? "",
          timestamp: entry.timestamp ?? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          attachments: entry.attachments ?? [],
        }));

      if (!importedMessages.length) throw new Error("No messages");

      const importedChat = createChat(Date.now(), parsed.title?.trim() || "Imported chat");
      importedChat.messages = importedMessages;
      setChats((previous) => [importedChat, ...previous]);
      setCurrentChatId(importedChat.id);
      setSidebarOpen(false);
      setStatus("Chat imported");
      showToast("Chat imported");
    } catch {
      setStatus("Import failed");
      showToast("Import failed");
    }
  };

  const toggleListening = () => {
    if (!voiceSupported || !recognitionRef.current) {
      showToast("Speech recognition is not available in this browser");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    setVoiceTranscript("");
    setListening(true);
    recognitionRef.current.start();
    showToast("Listening...");
  };

  const speakResponse = (text: string) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.speak(utterance);
  };

  const createNewChat = () => {
    const newChat = createChat(
      Date.now(),
      "New Chat",
      activeProjectFilter === "all" ? currentChat?.projectId ?? "general" : activeProjectFilter
    );
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    // Reset conversation-specific UI state so the new chat is clean
    setMessage("");
    setAttachments([]);
    setActivePanel("chat");
    setSidebarOpen(false);
    setImageMode(false);
    setImageResults([]);
    setVoiceMode(false);
    setListening(false);
    setVoiceTranscript("");
    setCopiedMessageId(null);
    setSearch("");
    setActiveProjectFilter("all");
    setPersona("helper");
    setAiMode("fast");
    setTaskMode("default");
    setUseMemory(true);
    setMemory("No saved memory yet.");
    setStatus("Started a fresh conversation");
    // Clear persisted app state so reload won't restore previous UI choices
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    showToast("New chat started");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        createNewChat();
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerRef.current?.focus();
      }

      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        setTheme((value) => (value === "dark" ? "light" : "dark"));
        showToast("Theme toggled");
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePanel("settings");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const updateCurrentChat = (messages: Message[]) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages,
              title:
                chat.title === "New Chat"
                  ? (
                      messages.find((entry) => entry.role === "user")?.content ??
                      "New Chat"
                    ).slice(0, 35)
                  : chat.title,
            }
          : chat
      )
    );
  };

  const deleteChat = (id: number) => {
    if (chats.length === 1) return;

    const nextChats = chats.filter((chat) => chat.id !== id);
    setChats(nextChats);
    setCurrentChatId(nextChats[0].id);
    setStatus("Chat removed");
    showToast("Chat removed");
  };

  const renameChat = (id: number) => {
    const chat = chats.find((entry) => entry.id === id);
    if (!chat) return;

    const nextTitle = window.prompt("Rename chat", chat.title);
    if (!nextTitle) return;

    setChats((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, title: nextTitle.trim() || entry.title } : entry))
    );
    setStatus("Chat renamed");
    showToast("Chat renamed");
  };

  const pinChat = (id: number) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === id ? { ...chat, pinned: !chat.pinned } : chat))
    );
    setStatus("Pin updated");
    showToast("Pin updated");
  };

  const archiveChat = (id: number) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === id ? { ...chat, archived: !chat.archived } : chat))
    );
    setStatus("Archive updated");
    showToast("Archive updated");
  };

  const createProject = () => {
    const nextName = window.prompt("Create project", "New project");
    if (!nextName?.trim()) return;

    const newProject = {
      id: `project-${Date.now()}`,
      name: nextName.trim(),
      color: ["cyan", "violet", "emerald"][projects.length % 3] as Project["color"],
    };

    setProjects((prev) => [...prev, newProject]);
    setActiveProjectFilter(newProject.id);
    showToast(`Project created: ${newProject.name}`);
  };

  const assignCurrentChatProject = (projectId: string) => {
    if (!currentChat) return;
    setChats((prev) => prev.map((chat) => (chat.id === currentChat.id ? { ...chat, projectId } : chat)));
    showToast("Project updated");
  };

  const addNote = () => {
    const title = window.prompt("Note title", "Untitled note");
    if (!title?.trim()) return;

    const nextNote: Note = {
      id: `note-${Date.now()}`,
      title: title.trim(),
      content: "Start writing here...",
      createdAt: "Just now",
    };

    setNotes((prev) => [nextNote, ...prev]);
    showToast("Note added");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const addTask = () => {
    const title = window.prompt("Task title", "New task");
    if (!title?.trim()) return;

    setTasks((prev) => [{ id: `task-${Date.now()}`, title: title.trim(), done: false }, ...prev]);
    showToast("Task added");
  };

  const clearConversation = () => {
    if (!currentChat) return;
    const resetMessage = createMessage(
      "assistant",
      "Conversation cleared. Start a new topic whenever you are ready."
    );
    updateCurrentChat([resetMessage]);
    setStatus("Conversation cleared");
    showToast("Conversation cleared");
  };

  const copyMessage = async (content: string, id: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(id);
      setStatus("Message copied");
      showToast("Message copied");
      window.setTimeout(() => setCopiedMessageId(null), 1200);
    } catch {
      setStatus("Copy failed");
      showToast("Copy failed");
    }
  };

  const retryMessage = () => {
    if (!currentChat) return;
    const lastUserMessage = [...currentChat.messages]
      .reverse()
      .find((entry) => entry.role === "user");

    if (!lastUserMessage) return;
    void sendMessage(lastUserMessage.content, true);
  };

  const editMessage = (id: number) => {
    if (!currentChat) return;
    const target = currentChat.messages.find((entry) => entry.id === id);
    if (!target) return;

    const nextValue = window.prompt("Edit message", target.content);
    if (!nextValue) return;

    const nextMessages = currentChat.messages.map((entry) =>
      entry.id === id ? { ...entry, content: nextValue.trim() || entry.content } : entry
    );
    updateCurrentChat(nextMessages);
    setStatus("Message updated");
    showToast("Message updated");
  };

  const stopGeneration = () => {
    stopRequestedRef.current = true;
    setLoading(false);
    setStatus("Generation stopped");
    showToast("Generation stopped");
  };

  const sendMessage = async (overrideMessage?: string, isRetry = false) => {
    const messageToSend = (overrideMessage ?? message).trim();
    if (!messageToSend || loading) return;

    if (!currentChat) return;

    const userMessage = createMessage("user", messageToSend, Date.now());
    const assistantMessage = createMessage("assistant", "", Date.now() + 1);
    const nextMessages = [
      ...currentChat.messages,
      {
        ...userMessage,
        attachments: attachments.length ? attachments : undefined,
      },
      assistantMessage,
    ];

    const activeChatId = currentChat.id;
    updateCurrentChat(nextMessages);
    setMessage("");
    setAttachments([]);
    setLoading(true);
    setStatus("Generating response");
    stopRequestedRef.current = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          history: currentChat.messages.slice(-8).map((entry) => ({ role: entry.role, content: entry.content })),
          model: selectedModel,
          stream: streamingEnabled,
          persona,
          mode: aiMode,
          taskMode,
          systemPrompt,
          useMemory,
          memory: useMemory ? memory : "",
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
          })),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      let reply = "I’m ready when you are.";

      if (streamingEnabled && response.body && contentType.includes("text/plain")) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamed = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          streamed += chunk;

          if (stopRequestedRef.current) break;

          setChats((prev) =>
            prev.map((chat) =>
              chat.id === activeChatId
                ? {
                    ...chat,
                    messages: chat.messages.map((entry) =>
                      entry.id === assistantMessage.id
                        ? {
                            ...entry,
                            content: streamed,
                            isStreaming: !done,
                          }
                        : entry
                    ),
                  }
                : chat
            )
          );
        }

        reply = streamed.trim();
      } else {
        const data = await response.json();
        reply = typeof data.reply === "string" ? data.reply : "I’m ready when you are.";
        const chunks = reply.match(/.{1,24}/g) ?? [reply];

        for (let index = 0; index < chunks.length; index += 1) {
          if (stopRequestedRef.current) break;
          await new Promise((resolve) => window.setTimeout(resolve, 20));

          setChats((prev) =>
            prev.map((chat) =>
              chat.id === activeChatId
                ? {
                    ...chat,
                    messages: chat.messages.map((entry) =>
                      entry.id === assistantMessage.id
                        ? {
                            ...entry,
                            content: `${entry.content}${chunks[index]}`,
                            isStreaming: index < chunks.length - 1,
                          }
                        : entry
                    ),
                  }
                : chat
            )
          );
        }
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map((entry) =>
                  entry.id === assistantMessage.id
                    ? { ...entry, content: reply.trim(), isStreaming: false }
                    : entry
                ),
              }
            : chat
        )
      );

      const summary = isRetry ? "Response regenerated" : "Response ready";
      if (useMemory) {
        const nextMemory = `${messageToSend} → ${reply}`;
        setMemory((previous) =>
          previous === "No saved memory yet."
            ? nextMemory
            : `${previous}\n${nextMemory}`.slice(0, 1400)
        );
      }
      setStatus(summary);
      showToast(summary);
    } catch {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map((entry) =>
                  entry.id === assistantMessage.id
                    ? { ...entry, content: "The request could not be completed right now.", isStreaming: false }
                    : entry
                ),
              }
            : chat
        )
      );
      setStatus("Request failed");
      showToast("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const nextAttachments = fileList.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      type: file.type || "file",
      size: `${(file.size / 1024).toFixed(1)} KB`,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "📄",
    }));

    setAttachments((previous) => [...previous, ...nextAttachments]);
    showToast(`${nextAttachments.length} file${nextAttachments.length > 1 ? "s" : ""} attached`);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id));
  };

  const handleAuth = (event: FormEvent) => {
    event.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      showToast("Please enter your email and password");
      return;
    }

    setIsAuthenticated(true);
    setStatus(authMode === "signup" ? "Account created" : "Signed in");
    showToast(authMode === "signup" ? "Account created" : "Signed in");
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setStatus("Signed out");
    showToast("Signed out");
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) return;

    setLoading(true);
    setStatus("Generating image");
    showToast("Generating image");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate an image for: ${imagePrompt}`,
          mode: aiMode,
          taskMode: "default",
          systemPrompt,
          imagePrompt,
          imageStyle,
          kind: "image",
        }),
      });

      const data = await response.json();
      const imageUrl = typeof data.imageUrl === "string" && data.imageUrl ? data.imageUrl : "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80";
      setImageResults((previous) => [
        {
          id: Date.now(),
          prompt: imagePrompt,
          url: imageUrl,
          style: imageStyle,
        },
        ...previous,
      ]);
      setImagePrompt("");
      setStatus("Image generated");
      showToast("Image generated");
    } catch {
      setStatus("Image generation failed");
      showToast("Image generation failed");
    } finally {
      setLoading(false);
    }
  };

  const shellSurfaceClass = theme === "dark"
    ? "border-white/10 bg-slate-900/70 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl"
    : "border-slate-200/80 bg-white/70 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl";

  const pillButtonClass = theme === "dark"
    ? "border-white/10 bg-slate-900/70 text-slate-200 hover:border-cyan-400/40 hover:bg-slate-800/80"
    : "border-slate-200 bg-white/80 text-slate-700 hover:border-cyan-400/40 hover:bg-cyan-50/70";

  const activePillClass = theme === "dark"
    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
    : "border-cyan-400/40 bg-cyan-50 text-cyan-700";

  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute inset-0 ${theme === "dark"
            ? "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(129,140,248,0.16),transparent_24%)]"
            : "bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(167,139,250,0.18),transparent_24%)]"}`}
        />
        <motion.div
          animate={{ y: [0, -12, 0], x: [0, 10, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 18, 0], x: [0, -14, 0], opacity: [0.28, 0.55, 0.28] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] right-[10%] h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
        />
      </div>

      <div className="relative flex min-h-screen w-full flex-col lg:flex-row">
        {toastMessage ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed right-4 top-4 z-40 rounded-full border border-cyan-400/30 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur"
          >
            {toastMessage}
          </motion.div>
        ) : null}

        <motion.aside
          initial={false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`${sidebarOpen ? "flex" : "hidden lg:flex"} w-full flex-col border-b border-white/10 bg-slate-950/55 p-3 backdrop-blur-xl lg:w-[320px] lg:border-b-0 lg:border-r lg:p-4`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${activeAccent.chip}`}>ZeroGen</p>
              <h2 className="text-xl font-semibold">AI workspace</h2>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 lg:hidden"
            >
              Close
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={createNewChat}
            className={`mb-4 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-medium transition ${activeAccent.button}`}
          >
            <span className="text-lg">＋</span>
            <span>New chat</span>
          </motion.button>

          <div className={`mb-3 rounded-[20px] border p-3 ${shellSurfaceClass}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Projects</p>
              <button onClick={createProject} className="text-xs text-cyan-400">
                + New
              </button>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveProjectFilter("all")}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${activeProjectFilter === "all" ? `${activeAccent.active}` : "text-slate-300 hover:bg-slate-800/70"}`}
              >
                All chats
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setActiveProjectFilter(project.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${activeProjectFilter === project.id ? `${activeAccent.active}` : "text-slate-300 hover:bg-slate-800/70"}`}
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </button>
              ))}
            </div>
          </div>

          <label className={`mb-3 flex items-center gap-2 rounded-[18px] border px-3 py-2.5 text-sm transition ${shellSurfaceClass}`}>
            <span className="text-base text-cyan-300">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent outline-none"
            />
          </label>

          <div className="space-y-2 overflow-y-auto pr-1">
            {filteredChats.map((chat) => (
              <motion.div
                key={chat.id}
                whileHover={{ y: -2, scale: 1.01 }}
                className={`w-full rounded-[20px] border p-3 text-left transition ${
                  currentChat?.id === chat.id
                    ? `${activeAccent.active} border-cyan-400/35 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_16px_40px_rgba(34,211,238,0.12)]`
                    : `${shellSurfaceClass} hover:border-cyan-400/20`
                }`}
              >
                <button
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setSidebarOpen(false);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{chat.title}</p>
                    {chat.pinned ? <span>📌</span> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {chat.messages[chat.messages.length - 1]?.content ?? "New conversation"}
                  </p>
                </button>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    title="Delete chat"
                    className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10"
                  >
                    <span>🗑</span>
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <motion.header
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 backdrop-blur-xl lg:px-6 ${
              theme === "dark"
                ? "border-white/10 bg-slate-950/70"
                : "border-slate-200/80 bg-white/80"
            }`}
          >
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSidebarOpen((value) => !value)}
                className={`rounded-full border px-3 py-2 text-sm transition ${pillButtonClass}`}
              >
                ☰
              </motion.button>
              <div>
                <p className="text-sm text-slate-400">Current chat</p>
                <h3 className="font-semibold">{currentChat?.title ?? "New chat"}</h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={currentChat?.projectId ?? "general"}
                onChange={(event) => assignCurrentChatProject(event.target.value)}
                className={`rounded-full border px-3 py-2 text-sm outline-none transition ${pillButtonClass}`}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id} className="bg-slate-950">
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`rounded-full border px-3 py-2 text-sm outline-none transition ${pillButtonClass}`}
              >
                <option value="local">Local</option>
                <option value="gemini-2.0-flash">Gemini</option>
                <option value="gpt-4o-mini">OpenAI gpt-4o-mini</option>
                <option value="gpt-4.1-mini">OpenAI gpt-4.1-mini</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStreamingEnabled((v) => !v)}
                className={`rounded-full border px-3 py-2 text-sm transition ${streamingEnabled ? activePillClass : pillButtonClass}`}
              >
                {streamingEnabled ? "● Streaming" : "Streaming off"}
              </motion.button>
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActivePanel((value) => (value === "chat" ? "settings" : "chat"))}
                  className={`rounded-full border px-3 py-2 text-sm transition ${pillButtonClass}`}
                >
                  ☰ Menu
                </motion.button>
                <div className={`absolute right-0 top-11 z-30 w-56 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-xl ${activePanel === "chat" ? "hidden" : "block"}`}>
                  <div className="space-y-1">
                    <button onClick={() => togglePanel("chat")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "chat" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      💬 General
                    </button>
                    <button onClick={() => togglePanel("workspace")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "workspace" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      🗂 Workspace
                    </button>
                    <button onClick={() => togglePanel("image")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "image" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      🖼 Image AI
                    </button>
                    <button onClick={() => togglePanel("voice")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "voice" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      🎙 Voice
                    </button>
                    <button onClick={() => togglePanel("settings")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "settings" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      ⚙️ Settings
                    </button>
                    <button onClick={() => togglePanel("auth")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${activePanel === "auth" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-slate-800/70"}`}>
                      {isAuthenticated ? "👤 Profile" : "🔐 Login"}
                    </button>
                    <button onClick={() => shareCurrentChat()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">
                      🔗 Share
                    </button>
                    <button onClick={() => renameChat(currentChat?.id ?? 1)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">
                      ✏️ Rename
                    </button>
                    <button onClick={() => pinChat(currentChat?.id ?? 1)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">
                      {currentChat?.pinned ? "📌 Unpin" : "📌 Pin"}
                    </button>
                    <button onClick={() => archiveChat(currentChat?.id ?? 1)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">
                      {currentChat?.archived ? "🗂 Restore" : "🗂 Archive"}
                    </button>
                    <button onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">
                      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.header>

          <AnimatePresence mode="wait">
            {activePanel === "settings" ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`mx-4 mt-4 rounded-[24px] border p-4 shadow-[0_20px_60px_rgba(2,6,23,0.16)] ${shellSurfaceClass}`}
              >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Preferences</p>
                  <p className="text-sm text-slate-400">Tune the workspace feel and shortcuts.</p>
                </div>
                <button onClick={() => setActivePanel("chat")} className="rounded-full border border-slate-700 px-3 py-1 text-sm">
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Theme</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setTheme("dark")} className={`rounded-full border px-3 py-1 text-sm ${theme === "dark" ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}>
                      Dark
                    </button>
                    <button onClick={() => setTheme("light")} className={`rounded-full border px-3 py-1 text-sm ${theme === "light" ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}>
                      Light
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Accent</p>
                  <div className="flex flex-wrap gap-2">
                    {(["cyan", "violet", "emerald"] as AccentTheme[]).map((value) => (
                      <button
                        key={value}
                        onClick={() => setAccentTheme(value)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize ${accentTheme === value ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Persona</p>
                  <div className="flex flex-wrap gap-2">
                    {(["helper", "coder", "writer", "analyst"] as Persona[]).map((value) => (
                      <button
                        key={value}
                        onClick={() => setPersona(value)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize ${persona === value ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">AI mode</p>
                  <div className="flex flex-wrap gap-2">
                    {(["fast", "thinking", "deep"] as AIModelMode[]).map((value) => (
                      <button
                        key={value}
                        onClick={() => setAiMode(value)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize ${aiMode === value ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">System prompt</p>
                <input
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                  placeholder="Custom instructions for the assistant"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={compactMode} onChange={() => setCompactMode((value) => !value)} />
                  Compact mode
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useMemory} onChange={() => setUseMemory((value) => !value)} />
                  Memory
                </label>
                <span className="text-sm text-slate-400">Shortcuts: Ctrl/Cmd + N new chat • Ctrl/Cmd + K focus composer • Ctrl/Cmd + P settings</span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                <p className="mb-2 font-medium">Active memory</p>
                <p className="whitespace-pre-wrap text-slate-400">{memory}</p>
              </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className="flex-1 min-h-0 overflow-y-auto px-2 py-2 sm:px-3 lg:px-4"
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            {dragActive ? (
              <div className="mb-4 rounded-2xl border border-dashed border-cyan-500/60 bg-cyan-500/10 p-4 text-sm text-cyan-300">
                Drop files here to get started with future uploads.
              </div>
            ) : null}

            <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3">
              {activePanel === "chat" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`sticky top-0 z-10 rounded-[24px] border px-3 py-3 shadow-[0_14px_40px_rgba(2,6,23,0.16)] ${shellSurfaceClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">ZeroGen chat</p>
                      <h4 className="text-[15px] font-semibold leading-6">Ask anything and keep the workspace visible.</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["Summarize this idea", "Draft a plan", "Refactor this code", "Remove this"] as string[]).map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setMessage(prompt)}
                          className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {activePanel === "auth" ? (
                !isAuthenticated ? (
                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Account access</p>
                        <p className="text-sm text-slate-400">Sign in or create an account to unlock profile-based features.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm ${activeAccent.active}`}>Phase 7</span>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthMode("login")}
                        className={`rounded-full border px-3 py-1 text-sm ${authMode === "login" ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}
                      >
                        Login
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode("signup")}
                        className={`rounded-full border px-3 py-1 text-sm ${authMode === "signup" ? "border-cyan-500 text-cyan-400" : "border-slate-700"}`}
                      >
                        Signup
                      </button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-3">
                      {authMode === "signup" ? (
                        <input
                          value={authName}
                          onChange={(event) => setAuthName(event.target.value)}
                          placeholder="Your name"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                        />
                      ) : null}
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="Email"
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                      />
                      <input
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="Password"
                        type="password"
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                      />
                      <button type="submit" className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeAccent.button}`}>
                        {authMode === "signup" ? "Create account" : "Sign in"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Your profile</p>
                        <p className="text-sm text-slate-400">Signed in with a demo account experience.</p>
                      </div>
                      <button onClick={logout} className="rounded-full border border-slate-700 px-3 py-1 text-sm">
                        Logout
                      </button>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <p className="font-medium">{authName || "ZeroGen Member"}</p>
                      <p className="mt-1 text-slate-400">{authEmail || "member@zerogen.app"}</p>
                      <p className="mt-2 text-slate-500">Plan: Pro • Sync: Enabled • Avatar: Ready</p>
                    </div>
                  </div>
                )
              ) : null}

              {activePanel === "workspace" ? (
                <>
                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Workspace notes</p>
                        <p className="text-sm text-slate-400">Capture ideas and keep follow-up tasks close to the conversation.</p>
                      </div>
                      <button onClick={addNote} className="rounded-full border border-slate-700 px-3 py-1 text-sm">
                        + Note
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {notes.map((note) => (
                        <div key={note.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                          <p className="font-medium">{note.title}</p>
                          <p className="mt-2 text-sm text-slate-400">{note.content}</p>
                          <p className="mt-2 text-xs text-slate-500">{note.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Task board</p>
                        <p className="text-sm text-slate-400">Track progress without leaving the workspace.</p>
                      </div>
                      <button onClick={addTask} className="rounded-full border border-slate-700 px-3 py-1 text-sm">
                        + Task
                      </button>
                    </div>
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <label key={task.id} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                          <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                          <span className={task.done ? "text-slate-500 line-through" : "text-slate-300"}>{task.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Workspace insights</p>
                        <p className="text-sm text-slate-400">A quick snapshot of momentum and activity.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {insightMetrics.map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-sm text-slate-400">{metric.label}</p>
                          <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                          <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Activity timeline</p>
                        <p className="text-sm text-slate-400">Recent movements across the workspace.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {timelineItems.map((item) => (
                        <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">{item.title}</p>
                              <span className="text-xs text-slate-500">{item.time}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

                {activePanel === "image" ? (
                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Image AI</p>
                        <p className="text-sm text-slate-400">Describe a visual concept and generate a polished idea instantly.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm ${activeAccent.active}`}>Demo mode</span>
                    </div>

                    <div className="space-y-3">
                      <input
                        value={imagePrompt}
                        onChange={(event) => setImagePrompt(event.target.value)}
                        placeholder="e.g. A futuristic city at sunrise"
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                      />
                      <select
                        value={imageStyle}
                        onChange={(event) => setImageStyle(event.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none"
                      >
                        <option value="cinematic">Cinematic</option>
                        <option value="minimal">Minimal</option>
                        <option value="editorial">Editorial</option>
                        <option value="storybook">Storybook</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void generateImage()}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeAccent.button}`}
                      >
                        Generate concept
                      </button>
                    </div>

                    {imageResults.length ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {imageResults.map((result) => (
                          <div key={result.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                            <img src={result.url} alt={result.prompt} className="h-40 w-full object-cover" />
                            <div className="p-3">
                              <p className="text-sm font-medium">{result.prompt}</p>
                              <p className="mt-1 text-xs text-slate-500">Style: {result.style}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-400">No image concepts yet. Create your first prompt to start exploring.</p>
                    )}
                  </div>
                ) : null}

                {activePanel === "voice" ? (
                  <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Voice mode</p>
                        <p className="text-sm text-slate-400">Capture spoken prompts and hear responses in a natural flow.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm ${activeAccent.active}`}>Hands-free</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium ${listening ? "bg-rose-500/20 text-rose-300" : activeAccent.button}`}
                      >
                        {listening ? "Stop listening" : "Start listening"}
                      </button>
                      <button
                        type="button"
                        onClick={() => speakResponse(voiceTranscript || "No transcript yet.")}
                        className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
                      >
                        Read aloud
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Transcript</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                        {voiceTranscript || "Press start listening to capture your voice input."}
                      </p>
                    </div>

                    <p className="mt-3 text-sm text-slate-400">
                      {voiceSupported ? "Speech recognition is available in this browser." : "Speech recognition is not supported here, so voice capture will stay demo-only."}
                    </p>
                  </div>
                ) : null}

                {activePanel === "chat" ? (
                  <>
                    <AnimatePresence initial={false}>
                      {currentChat?.messages.map((entry) => (
                        <motion.article
                          key={entry.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          layout
                          className={`rounded-[24px] border px-3.5 py-3.5 shadow-[0_14px_40px_rgba(2,6,23,0.12)] transition-all duration-300 ${
                            entry.role === "assistant"
                              ? theme === "dark"
                                ? "border-white/10 bg-slate-900/70"
                                : "border-slate-200 bg-white/90"
                              : theme === "dark"
                                ? "ml-auto max-w-[92%] border-cyan-400/25 bg-cyan-500/10"
                                : "ml-auto max-w-[92%] border-cyan-400/20 bg-cyan-50"
                          } ${compactMode ? "px-3 py-2.5" : "px-3.5 py-3.5"}`}
                        >
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      <span>{entry.role === "assistant" ? "Assistant" : "You"}</span>
                      <span>{entry.timestamp}</span>
                    </div>
                    <div className={`space-y-1.5 text-[14px] leading-7 ${entry.role === "assistant" ? "text-slate-200" : "text-slate-100"}`}>
                      {renderMessageContent(entry.content)}
                    </div>
                    {entry.role === "assistant" ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-slate-400">
                          <button onClick={() => copyMessage(entry.content, entry.id)}>
                            {copiedMessageId === entry.id ? "Copied" : "Copy"}
                          </button>
                          <button onClick={() => void sendMessage(entry.content, true)}>Regenerate</button>
                          <button onClick={() => retryMessage()}>Retry</button>
                          <button onClick={() => editMessage(entry.id)}>Edit</button>
                        </div>
                        {!entry.isStreaming ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["Can you expand on that?","Give a simple example","Explain like I'm five"] as string[]).map((sugg) => (
                              <button
                                key={sugg}
                                onClick={() => void sendMessage(sugg)}
                                className="rounded-full border px-2.5 py-1 text-[12px] text-slate-300"
                              >
                                {sugg}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <button onClick={() => editMessage(entry.id)}>Edit</button>
                        <button onClick={() => copyMessage(entry.content, entry.id)}>
                          {copiedMessageId === entry.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                        </motion.article>
                        ))}
                    </AnimatePresence>

                    {loading && currentChat?.messages[currentChat.messages.length - 1]?.role === "assistant" && currentChat?.messages[currentChat.messages.length - 1]?.content === "" ? (
                      <div className={`rounded-3xl border p-4 ${theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
                        <div className="mb-3 h-3 w-28 animate-pulse rounded-full bg-slate-700" />
                        <div className="space-y-2">
                          <div className="h-3 w-full animate-pulse rounded-full bg-slate-700/80" />
                          <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-700/70" />
                          <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-700/60" />
                        </div>
                      </div>
                    ) : null}

                    <div ref={messagesEndRef} />
                  </>
                ) : null}
            </div>
          </div>

          {activePanel === "chat" ? (
            <div className={`border-t px-3 py-3 sm:px-4 lg:px-6 ${theme === "dark" ? "border-white/10 bg-slate-950/70" : "border-slate-200/80 bg-white/80"}`}>
              <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <span>{status}</span>
                  {loading ? <span className={`${activeAccent.chip}`}>● streaming</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-sm">
                      <span>{attachment.name}</span>
                      <button type="button" onClick={() => removeAttachment(attachment.id)} className="text-slate-400">
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className={`overflow-hidden rounded-[24px] border p-2.5 shadow-[0_20px_70px_rgba(2,6,23,0.3)] sm:p-3 ${shellSurfaceClass}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5 text-[13px] text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300">
                        <span>＋</span>
                        <span>Attach</span>
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,image/*,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/zip,.zip"
                          className="hidden"
                          onChange={(event) => {
                            if (event.target.files) {
                              handleFiles(event.target.files);
                              event.target.value = "";
                            }
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(["default", "explain", "rewrite"] as TaskMode[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setTaskMode(value)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${taskMode === value ? "border-cyan-500 text-cyan-400" : "border-slate-700 text-slate-300"}`}
                          >
                            {value === "default" ? "General" : value}
                          </button>
                        ))}
                        {promptTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => insertTemplate(template.prompt)}
                            className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Composer</span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <textarea
                      ref={composerRef}
                      value={message}
                      onChange={(event) => {
                        setMessage(event.target.value);
                        const target = event.currentTarget;
                        target.style.height = "auto";
                        target.style.height = `${Math.min(180, target.scrollHeight)}px`;
                      }}
                      onInput={(event) => {
                        const target = event.currentTarget;
                        target.style.height = "auto";
                        target.style.height = `${Math.min(180, target.scrollHeight)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Ask anything..."
                      rows={1}
                      className={`min-h-[110px] flex-1 resize-none rounded-[18px] border px-3.5 py-3 text-[14px] outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.2)] ${theme === "dark" ? "border-white/10 bg-slate-950/80 text-slate-100" : "border-slate-200 bg-white/90 text-slate-900"}`}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={loading}
                      className={`rounded-[18px] px-3.5 py-3 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${activeAccent.button}`}
                    >
                      {loading ? "Thinking..." : "Send"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}