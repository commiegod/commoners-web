import AdminPanel from "./AdminPanel";

export const metadata = { robots: "noindex" };

export default async function AdminPage({ searchParams }) {
  const { token } = await searchParams;

  if (!token || token !== process.env.ADMIN_SECRET) {
    return (
      <div className="max-w-sm mx-auto py-24 text-center">
        <h1 className="font-blackletter text-2xl text-gold mb-3">Admin</h1>
        <p className="text-sm text-muted">Access denied.</p>
      </div>
    );
  }

  return <AdminPanel token={token} />;
}
