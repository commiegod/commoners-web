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
        {entries.map(({ date, name, image }) => (
          <div
            key={date}
            className="flex-shrink-0 w-40 bg-card border border-border overflow-hidden"
          >
            <img
              src={image}
              alt={name}
              className="w-full aspect-square object-cover"
            />
            <div className="p-2">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-xs text-muted">{date}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
