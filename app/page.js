import AuctionCarousel from "./components/AuctionCarousel";
import RecentAuctions from "./components/RecentAuctions";
import DaoSuccesses from "./components/DaoSuccesses";

export default function Home() {
  return (
    <div className="space-y-16">
      <AuctionCarousel />
      <RecentAuctions />
      <DaoSuccesses />
    </div>
  );
}
