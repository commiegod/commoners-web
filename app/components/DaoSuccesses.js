import achievements from "../../data/achievements.json";

export default function DaoSuccesses() {
  return (
    <section>
      <h2 className="font-blackletter text-2xl text-gold mb-6">Milestones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {achievements.map((a, i) => (
          <div key={i} className="border border-border bg-card p-4">
            <p className="text-xs text-muted tracking-widest uppercase mb-1">
              {a.date}
            </p>
            <h3 className="font-semibold mb-2">{a.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{a.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
