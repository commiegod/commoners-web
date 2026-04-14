import { fetchAllActiveCommoners } from "../../lib/collection";
import GalleryClient from "./GalleryClient";

export const metadata = {
  title: "Gallery — Commoner's DAO",
  description:
    "Browse all active Commoner NFTs — 3-trait MidEvils that hold governance rights in the DAO.",
};

// Revalidate every hour — picks up burns and new MidEvils automatically.
// Transferred PrimeVils are filtered out in lib/collection.js.
export const revalidate = 3600;

export default async function GalleryPage() {
  const nfts = await fetchAllActiveCommoners();
  return <GalleryClient nfts={nfts} />;
}
