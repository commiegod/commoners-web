import schedule from '../data/auction-schedule.json';
import bounties from '../data/bounties.json';

export function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function getAuctionForDate(dateStr) {
  const entry = schedule[dateStr];
  if (!entry) return null;

  const bountyData = bounties[dateStr] || { human: [], ai: [] };

  return {
    date: dateStr,
    ...entry,
    bounty: bountyData,
  };
}

export function getTodayAuction() {
  return getAuctionForDate(getTodayDateString());
}

export function getRecentAuctions(count = 5) {
  const dates = Object.keys(schedule).sort().reverse();
  const today = getTodayDateString();
  const pastDates = dates.filter(d => d < today);
  return pastDates.slice(0, count).map(d => getAuctionForDate(d)).filter(Boolean);
}

export function getUpcomingAuctions(count = 5) {
  const dates = Object.keys(schedule).sort();
  const today = getTodayDateString();
  const futureDates = dates.filter(d => d > today);
  return futureDates.slice(0, count).map(d => getAuctionForDate(d)).filter(Boolean);
}

export function getAllScheduledDates() {
  return Object.keys(schedule).sort();
}
