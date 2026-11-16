import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  Handshake,
  Package,
  Search,
  ShieldCheck,
  Sprout,
  Store,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";

const farmerSteps = [
  {
    title: "Create your profile",
    description:
      "Register as a farmer and set up your farmer profile with your farm details and location.",
    Icon: UserRound,
  },
  {
    title: "List your produce",
    description:
      "Add your crops and produce, photographs, prices, quantities, grades and availability.",
    Icon: Package,
  },
  {
    title: "Connect with buyers",
    description:
      "Reach individual buyers, businesses and institutions looking for agricultural produce.",
    Icon: UsersRound,
  },
  {
    title: "Manage orders",
    description:
      "Receive and manage orders, communicate with buyers and track delivery or collection.",
    Icon: ClipboardList,
  },
  {
    title: "Grow your business",
    description:
      "Access market information, farming resources and Agrovet suppliers.",
    Icon: Sprout,
  },
];

const supplierSteps = [
  {
    title: "Register your business",
    description:
      "Create your Agrovet Supplier account and set up your business profile, shop details and location.",
    Icon: Store,
  },
  {
    title: "List your products",
    description:
      "Showcase seeds, fertilisers, animal feeds, veterinary supplies, crop-protection products, tools and other agricultural inputs.",
    Icon: Package,
  },
  {
    title: "Reach more farmers",
    description:
      "Make your products discoverable to farmers searching for agricultural supplies in different locations.",
    Icon: UsersRound,
  },
  {
    title: "Manage stock and orders",
    description:
      "Manage product quantities, stock movements, customer orders, collections and deliveries.",
    Icon: ClipboardList,
  },
  {
    title: "Grow your business",
    description:
      "Build customer relationships, promote available products and review your recorded sales and business reports.",
    Icon: TrendingUp,
  },
];

const buyerBenefits = [
  {
    title: "Find quality products",
    description:
      "Discover fresh farm produce and agricultural inputs from trusted sellers.",
    Icon: Search,
  },
  {
    title: "Connect with sellers",
    description:
      "Buy directly from farmers and Agrovet suppliers through one marketplace.",
    Icon: Handshake,
  },
  {
    title: "Get fair prices",
    description:
      "Find competitive prices for quality agricultural products.",
    Icon: ShieldCheck,
  },
  {
    title: "Support local agriculture",
    description:
      "Help grow Kenya's agricultural sector by supporting local farmers and suppliers.",
    Icon: Sprout,
  },
];

export default function Home() {
  return (
    <>
      <section
        className="home-hero"
        style={{ color: "white", padding: "76px 0" }}
      >
        <div className="container">
          <h1 style={{ fontSize: "clamp(40px,6vw,64px)", maxWidth: 780 }}>
            Agriculture moves better when markets connect.
          </h1>
          <p style={{ fontSize: 18, maxWidth: 650 }}>
            A shared marketplace connecting farmers, Agri-Vet suppliers and
            buyers.
          </p>
          <Link
            className="btn"
            style={{ background: "white", color: "#205d39" }}
            href="/signup"
          >
            Create account
          </Link>{" "}
          <Link className="btn btn-secondary" href="/login">
            Sign in
          </Link>
        </div>
      </section>
      <section
        className="farmer-how-it-works"
        aria-labelledby="farmer-how-it-works-title"
      >
        <div className="container farmer-how-layout">
          <Image
            className="farmer-how-photo"
            src="/images/farmer-how-it-works.png"
            alt="Farmer using a phone while holding leafy produce in a field"
            width={630}
            height={683}
            sizes="(max-width: 850px) 100vw, 50vw"
          />
          <div className="farmer-how-content">
            <p className="farmer-how-label">
              <Sprout size={20} strokeWidth={2.4} aria-hidden="true" />
              For Farmers
            </p>
            <h2 id="farmer-how-it-works-title">How It Works</h2>
            <p className="farmer-how-intro">
              Getting started on Mavuno Market is simple. Here is how farmers
              can benefit from our platform.
            </p>
            <ol className="farmer-step-list">
              {farmerSteps.map(({ title, description, Icon }, index) => (
                <li className="farmer-step" key={title}>
                  <span className="farmer-step-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3>
                      Step {index + 1} — {title}
                    </h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link className="btn farmer-how-join" href="/signup">
              Join as a Farmer
            </Link>
          </div>
        </div>
      </section>
      <section
        className="farmer-how-it-works supplier-how-it-works"
        aria-labelledby="supplier-how-it-works-title"
      >
        <div className="container farmer-how-layout">
          <Image
            className="farmer-how-photo"
            src="/images/agrovet-how-it-works.png"
            alt="Agrovet shop owner serving a farmer with agricultural supplies"
            width={628}
            height={686}
            sizes="(max-width: 850px) 100vw, 50vw"
          />
          <div className="farmer-how-content supplier-how-content">
            <p className="farmer-how-label">
              <Store size={20} strokeWidth={2.4} aria-hidden="true" />
              For Agrovet Suppliers
            </p>
            <h2 id="supplier-how-it-works-title">Supply. Connect. Grow.</h2>
            <p className="farmer-how-intro">
              Mavuno Market helps agrovet businesses reach more farmers,
              showcase agricultural products and manage their sales from one
              marketplace.
            </p>
            <ol className="farmer-step-list">
              {supplierSteps.map(({ title, description, Icon }, index) => (
                <li className="farmer-step" key={title}>
                  <span className="farmer-step-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3>
                      Step {index + 1} — {title}
                    </h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              className="btn farmer-how-join"
              href="/signup?role=supplier"
            >
              Join as an Agrovet Supplier
            </Link>
          </div>
        </div>
      </section>
      <section
        className="farmer-how-it-works buyer-how-it-works"
        aria-labelledby="buyer-how-it-works-title"
      >
        <div className="container farmer-how-layout">
          <Image
            className="farmer-how-photo"
            src="/images/buyer-how-it-works.png"
            alt="Buyer selecting fresh leafy produce at a local market"
            width={628}
            height={686}
            sizes="(max-width: 850px) 100vw, 50vw"
          />
          <div className="farmer-how-content buyer-how-content">
            <p className="farmer-how-label">
              <Sprout size={20} strokeWidth={2.4} aria-hidden="true" />
              For Buyers
            </p>
            <h2 id="buyer-how-it-works-title">Discover. Buy. Benefit.</h2>
            <p className="farmer-how-intro">
              Mavuno Market connects you with trusted farmers and Agrovet
              suppliers to get quality agricultural products.
            </p>
            <ul className="farmer-step-list">
              {buyerBenefits.map(({ title, description, Icon }) => (
                <li className="farmer-step" key={title}>
                  <span className="farmer-step-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              className="btn farmer-how-join buyer-how-join"
              href="/signup?role=buyer_individual"
            >
              Continue as a buyer
            </Link>
          </div>
        </div>
      </section>
      <main className="container" style={{ padding: 40 }}>
        <h2>One platform. Three portals.</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {["Farmer", "Agri-Vet Supplier", "Buyer"].map((x) => (
            <div className="card" key={x}>
              <h3>{x}</h3>
              <p className="muted">
                Dedicated tools, shared marketplace and order workflows.
              </p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}