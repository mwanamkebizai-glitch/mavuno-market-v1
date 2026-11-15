import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

function SectionError() {
  return <p className="notice error-notice" role="alert">This farm record section could not be loaded.</p>;
}

export default async function Farms() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <main className="container" style={{ padding: 32 }}><p role="alert">Unable to verify your sign-in.</p></main>;
  }
  if (!user) {
    return <main className="container" style={{ padding: 32 }}>Please <Link href="/login">sign in</Link> to view farm records.</main>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return <main className="container" style={{ padding: 32 }}><p className="notice error-notice" role="alert">Your account role could not be verified.</p></main>;
  }
  if (profile?.role !== "farmer") {
    return (
      <>
        <Nav role={profile?.role ?? null} />
        <main className="container" style={{ padding: 32 }}>
          <section className="card"><h1>Farm management</h1><p className="muted">Farm records are available to Farmer accounts.</p></section>
        </main>
      </>
    );
  }

  const [farms, crops, activities, machinery, workers] = await Promise.all([
    supabase.from("farms").select("id,name,farm_type,size,size_unit,location_text")
      .eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("crop_calendars").select("id,crop,variety,growth_stage,planting_date,expected_harvest_date")
      .eq("owner_id", user.id).order("expected_harvest_date", { ascending: true }),
    supabase.from("farm_activities").select("id,activity_type,activity_date,description,cost")
      .eq("owner_id", user.id).order("activity_date", { ascending: false }),
    supabase.from("farm_machinery").select("id,name,model,status,next_service_date")
      .eq("owner_id", user.id).order("name", { ascending: true }),
    supabase.from("farm_workers").select("id,worker_name,role,active")
      .eq("owner_id", user.id).order("worker_name", { ascending: true }),
  ]);

  return (
    <>
      <Nav role={profile.role} />
      <main className="container" style={{ padding: "30px 0" }}>
        <div className="dashboard-heading">
          <div><p className="pill">Farmer workspace</p><h1>Farm management</h1></div>
          <Link className="btn" href="/farms/new">Add farm</Link>
        </div>

        <section className="dashboard-section" id="farms">
          <h2>My farms</h2>
          {farms.error ? <SectionError /> : !farms.data?.length ? (
            <section className="card"><p className="muted">No farms recorded yet.</p><Link className="btn" href="/farms/new">Add your first farm</Link></section>
          ) : (
            <div className="dashboard-list">
              {farms.data.map((farm) => (
                <article className="card" key={farm.id}>
                  <h3>{farm.name}</h3>
                  <p>{farm.farm_type} · {farm.size ?? "Size not recorded"} {farm.size_unit || ""}</p>
                  <p className="muted">{farm.location_text || "Location not recorded"}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="crops">
          <h2>Crop calendar</h2>
          {crops.error ? <SectionError /> : !crops.data?.length ? (
            <p className="muted">No crop calendar entries yet.</p>
          ) : (
            <div className="dashboard-list">
              {crops.data.map((crop) => (
                <article className="card dashboard-row" key={crop.id}>
                  <div><b>{crop.crop}</b><p className="muted">{crop.variety || "Variety not recorded"} · {crop.growth_stage || "Stage not recorded"}</p></div>
                  <span>Harvest: {crop.expected_harvest_date || "Not set"}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="activities">
          <h2>Farm activities</h2>
          {activities.error ? <SectionError /> : !activities.data?.length ? (
            <p className="muted">No farm activities recorded yet.</p>
          ) : (
            <div className="dashboard-list">
              {activities.data.map((activity) => (
                <article className="card dashboard-row" key={activity.id}>
                  <div><b>{activity.activity_type}</b><p>{activity.description || "No description provided."}</p></div>
                  <span className="muted">{activity.activity_date}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="machinery">
          <h2>Machinery</h2>
          {machinery.error ? <SectionError /> : !machinery.data?.length ? (
            <p className="muted">No machinery records yet.</p>
          ) : (
            <div className="dashboard-list">
              {machinery.data.map((item) => (
                <article className="card dashboard-row" key={item.id}>
                  <div><b>{item.name}</b><p className="muted">{item.model || "Model not recorded"} · {item.status || "Status not recorded"}</p></div>
                  <span>Next service: {item.next_service_date || "Not scheduled"}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="workers">
          <h2>Workers</h2>
          {workers.error ? <SectionError /> : !workers.data?.length ? (
            <p className="muted">No worker records yet.</p>
          ) : (
            <div className="dashboard-list">
              {workers.data.map((worker) => (
                <article className="card dashboard-row" key={worker.id}>
                  <b>{worker.worker_name}</b>
                  <span className="muted">{worker.role || "Role not recorded"} · {worker.active ? "Active" : "Inactive"}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
