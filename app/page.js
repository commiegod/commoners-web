import AuctionCarousel from "./components/AuctionCarousel";
import CurrentAuction from "./components/CurrentAuction";
import RecentAuctions from "./components/RecentAuctions";

export default function Home() {
  return (
    <div className="space-y-16">
      <AuctionCarousel />
      <CurrentAuction />
      <RecentAuctions />
    </div>
  );
}
