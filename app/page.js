import AuctionCarousel from "./components/AuctionCarousel";
import RecentAuctions from "./components/RecentAuctions";

export default function Home() {
  return (
    <div className="space-y-16">
      <AuctionCarousel />
      <RecentAuctions />
    </div>
  );
}
