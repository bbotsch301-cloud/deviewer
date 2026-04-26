"use client";

import { useMemo } from "react";
import { Console } from "@/components/Console";
import { EventList } from "@/components/EventList";
import { Header } from "@/components/Header";
import { PreviewLink } from "@/components/PreviewLink";
import { RepoInput } from "@/components/RepoInput";
import { useStream } from "@/components/useStream";

export default function Home() {
  const { state, connectRepo, removeRepo, rerun, viewRun } = useStream();

  const viewedRun = useMemo(
    () => state.runs.find((r) => r.id === state.currentRunId) ?? null,
    [state.runs, state.currentRunId],
  );

  return (
    <main className="flex min-h-screen flex-col">
      <Header connected={state.connected} />

      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-4">
          <RepoInput repos={state.repos} onConnect={connectRepo} onRemove={removeRepo} />
          <div className="min-h-[260px] flex-1">
            <EventList runs={state.runs} currentRunId={state.currentRunId} onSelect={viewRun} />
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-4">
          <PreviewLink run={viewedRun} />
          <div className="relative flex-1">
            <Console logs={state.logs} status={state.status} onRerun={rerun} />
          </div>
        </section>
      </div>
    </main>
  );
}
