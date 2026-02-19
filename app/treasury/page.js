import schedule from "../../data/auction-schedule.json";

function getAuctionHistory() {
  return Object.entries(schedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({ date, ...entry }));
}

export default function TreasuryPage() {
  const history = getAuctionHistory();

  return (
    <div>
      <h1 className="font-blackletter text-3xl text-gold mb-6">Treasury</h1>

      {/* Treasury Balance */}
      <div className="bg-card border border-border p-6 mb-8">
        <p className="text-sm text-muted mb-1">Treasury Balance</p>
        <p className="text-3xl font-bold text-gold">-- SOL</p>
        <p className="text-sm text-muted mt-2">
          Live balance coming in Phase 2 (Helius RPC integration).
          Treasury grows from auction fees collected on each sale.
        </p>
      </div>

      {/* Auction History */}
      <h2 className="font-blackletter text-2xl text-gold mb-4">Auction Schedule</h2>
      <div className="bg-card border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted whitespace-nowrap">Date</th>
              <th className="px-4 py-3 font-medium text-muted">NFT</th>
              <th className="px-4 py-3 font-medium text-muted hidden sm:table-cell">Traits</th>
              <th className="px-4 py-3 font-medium text-muted text-right hidden sm:table-cell">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map(({ date, name, image, traits }) => (
              <tr key={date} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted whitespace-nowrap">{date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img src={image} alt={name} className="w-8 h-8 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted hidden sm:table-cell">
                  {traits.join(" · ")}
                </td>
                <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
