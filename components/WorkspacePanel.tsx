"use client";

import React, { useState } from "react";
import { Plus, CheckSquare, Square, Trash2, StickyNote, Activity } from "lucide-react";

type WorkspacePanelProps = {
  projects: Array<{ id: string; name: string; color: string }>;
  notes: Array<{ id: string; title: string; content: string; createdAt?: string; created_at?: string }>;
  tasks: Array<{ id: string; title: string; done: number | boolean }>;
  onCreateNote: (title: string, content: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onCreateTask: (title: string) => Promise<void>;
  onToggleTask: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateProject: (name: string, color: string) => Promise<void>;
  theme?: "dark" | "light";
  accentTheme?: "cyan" | "violet" | "emerald";
};

export function WorkspacePanel({
  projects,
  notes,
  tasks,
  onCreateNote,
  onDeleteNote,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onCreateProject,
  theme = "dark",
  accentTheme = "cyan",
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "tasks" | "insights">("notes");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const isDark = theme === "dark";

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    await onCreateNote(noteTitle.trim(), noteContent.trim());
    setNoteTitle("");
    setNoteContent("");
    setIsAddingNote(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await onCreateTask(taskTitle.trim());
    setTaskTitle("");
  };

  const completedTasksCount = tasks.filter((t) => Boolean(t.done)).length;
  const totalTasksCount = tasks.length;
  const taskProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 shadow-xl transition-colors ${
        isDark ? "border-slate-800 bg-slate-900/80 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      {/* Workspace Header Tabs */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 mb-6 ${
        isDark ? "border-slate-800" : "border-slate-200"
      }`}>
        <div>
          <h3 className="text-base sm:text-lg font-bold">Workspace Hub</h3>
          <p className="text-xs text-slate-400">Keep persistent notes, task checklists, and productivity metrics</p>
        </div>

        <div className={`flex rounded-xl border p-1 ${
          isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-100"
        }`}>
          <button
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "notes"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span>Notes ({notes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "tasks"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Tasks ({tasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "insights"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Insights</span>
          </button>
        </div>
      </div>

      {/* Notes Tab */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Notes</p>
            <button
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAddingNote ? "Cancel" : "New Note"}</span>
            </button>
          </div>

          {isAddingNote && (
            <form onSubmit={handleAddNote} className={`space-y-3 rounded-2xl border p-4 ${
              isDark ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-slate-50"
            }`}>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title"
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium outline-none focus:border-cyan-400 ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
              />
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your note content here..."
                rows={3}
                className={`w-full rounded-xl border p-3.5 text-xs outline-none resize-none focus:border-cyan-400 ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shadow-sm"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`group relative rounded-2xl border p-4 transition ${
                  isDark ? "border-slate-800 bg-slate-950/70 hover:border-slate-700" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-xs sm:text-sm">{note.title}</h4>
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition"
                    title="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {note.content && <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">{note.content}</p>}
                <p className="mt-3 text-[10px] text-slate-500">{note.createdAt || note.created_at || "Recent"}</p>
              </div>
            ))}
            {notes.length === 0 && !isAddingNote && (
              <div className="col-span-2 py-8 text-center text-xs text-slate-500">
                No notes created yet. Click "+ New Note" to save ideas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Add a new task..."
              className={`flex-1 rounded-xl border px-3.5 py-2 text-xs font-medium outline-none focus:border-cyan-400 ${
                isDark ? "border-slate-700 bg-slate-950/80 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-2">
            {tasks.map((task) => {
              const isDone = Boolean(task.done);
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition ${
                    isDark ? "border-slate-800 bg-slate-950/70 hover:border-slate-700" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className="flex items-center gap-3 text-left flex-1"
                  >
                    {isDone ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                    <span className={`text-xs sm:text-sm font-medium ${isDone ? "text-slate-500 line-through" : ""}`}>
                      {task.title}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                No tasks on your board. Add your first task above!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${
              isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"
            }`}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Notes</p>
              <p className="mt-1.5 text-2xl font-bold text-cyan-400">{notes.length}</p>
              <p className="mt-1 text-[11px] text-slate-500">Documented ideas</p>
            </div>

            <div className={`rounded-2xl border p-4 ${
              isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"
            }`}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Task Completion</p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-400">{taskProgress}%</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {completedTasksCount} of {totalTasksCount} completed
              </p>
            </div>

            <div className={`rounded-2xl border p-4 ${
              isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"
            }`}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Projects</p>
              <p className="mt-1.5 text-2xl font-bold text-violet-400">{projects.length}</p>
              <p className="mt-1 text-[11px] text-slate-500">Workspace boards</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
