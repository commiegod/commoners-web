import AuctionCarousel from "./components/AuctionCarousel";
import CurrentAuction from "./components/CurrentAuction";
import RecentAuctions from "./components/RecentAuctions";
import DaoSuccesses from "./components/DaoSuccesses";

export default function Home() {
  return (
    <div className="space-y-16">
      <AuctionCarousel />
      <CurrentAuction />
      <RecentAuctions />
      <DaoSuccesses />
    </div>
  );
}
