export default function DashboardLoading() {
  return (
    <main className="container" style={{ padding: "30px 0" }} aria-busy="true" aria-label="Loading dashboard">
      <div className="card loading-card" />
      <div className="dashboard-grid">
        <div className="card loading-card" />
        <div className="card loading-card" />
        <div className="card loading-card" />
      </div>
      <div className="card loading-card" />
    </main>
  );
}
