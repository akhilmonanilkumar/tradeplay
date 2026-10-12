export default function MigrationNotice() {
  return (
    <div className="card p-5 text-sm">
      <div className="font-medium">One database update needed</div>
      <p className="mt-1 text-mute">
        Coach chats, memory, knowledgebase, lessons, reminders, emotion tracking and check-ins need migration{" "}
        <code className="num">supabase/migrations/0005_sessions_coach.sql</code>. Run it once in the Supabase SQL editor (or ask Claude to apply it), then reload.
      </p>
    </div>
  );
}

