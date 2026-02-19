import schedule from "../../data/auction-schedule.json";

function getScheduleEntries() {
  return Object.entries(schedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 10)
    .map(([date, entry]) => ({ date, ...entry }));
}

export default function RecentAuctions() {
  const entries = getScheduleEntries();

  if (entries.length === 0) return null;

  return (
    <section>
      <h2 className="font-blackletter text-2xl text-gold mb-6">Auction Schedule</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {entries.map(({ date, name }) => (
          <div
            key={date}
            className="flex-shrink-0 w-40 bg-card border border-border overflow-hidden"
          >
            {/* Placeholder — artwork revealed on auction day */}
            <div className="w-full aspect-square bg-border/30 flex items-center justify-center">
              <span className="font-blackletter text-2xl text-muted/30">?</span>
            </div>
            <div className="p-2">
              <p className="text-sm font-medium truncate text-muted">Commoner</p>
              <p className="text-xs text-muted">{date}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
