import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import {
  listProjects,
  createProject,
  deleteProject,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  listTasks,
  createTask,
  toggleTask,
  deleteTask,
  getUserSettings,
  updateUserSettings,
} from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const [projects, notes, tasks, settings] = [
      listProjects(user.id),
      listNotes(user.id),
      listTasks(user.id),
      getUserSettings(user.id),
    ];

    return NextResponse.json({
      projects,
      notes,
      tasks,
      settings,
    });
  } catch (error) {
    console.error("[api/workspace GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch workspace data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { type, data } = body;

    if (type === "project") {
      const project = createProject(user.id, data.name, data.color || "cyan");
      return NextResponse.json({ project }, { status: 201 });
    }

    if (type === "note") {
      const note = createNote(user.id, data.title, data.content || "");
      return NextResponse.json({ note }, { status: 201 });
    }

    if (type === "task") {
      const task = createTask(user.id, data.title);
      return NextResponse.json({ task }, { status: 201 });
    }

    if (type === "settings") {
      const settings = updateUserSettings(user.id, data);
      return NextResponse.json({ settings });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("[api/workspace POST] Error:", error);
    return NextResponse.json({ error: "Failed to create workspace item" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { type, data } = body;

    if (type === "note") {
      const note = updateNote(data.id, user.id, data.title, data.content);
      return NextResponse.json({ note });
    }

    if (type === "task_toggle") {
      const task = toggleTask(data.id, user.id);
      return NextResponse.json({ task });
    }

    if (type === "settings") {
      const settings = updateUserSettings(user.id, data);
      return NextResponse.json({ settings });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("[api/workspace PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update workspace item" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    if (type === "project") {
      deleteProject(id, user.id);
    } else if (type === "note") {
      deleteNote(id, user.id);
    } else if (type === "task") {
      deleteTask(id, user.id);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/workspace DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete workspace item" }, { status: 500 });
  }
}
