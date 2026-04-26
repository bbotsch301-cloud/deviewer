import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";
import { parseRepoUrl } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ repos: eventStore.listRepos() });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseRepoUrl(String(body?.repo ?? ""));
  if (!parsed) {
    return NextResponse.json(
      { error: "expected a GitHub repo URL like https://github.com/owner/name or owner/name" },
      { status: 400 },
    );
  }

  eventStore.addRepo(parsed.fullName);
  return NextResponse.json({ ok: true, repo: parsed.fullName, repos: eventStore.listRepos() });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const repo = url.searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "missing ?repo" }, { status: 400 });
  eventStore.removeRepo(repo);
  return NextResponse.json({ ok: true, repos: eventStore.listRepos() });
}
