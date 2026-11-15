export type AccountRole =
  | "farmer"
  | "supplier"
  | "buyer_individual"
  | "buyer_business"
  | "buyer_institution"
  | "admin";

export type DashboardKind = "farmer" | "supplier" | "buyer" | "admin" | "unknown";

export type RoleNavigationLink = {
  label: string;
  href: string;
};

const farmerLinks: RoleNavigationLink[] = [
  { label: "Farm management", href: "/farms" },
  { label: "Crops", href: "/farms#crops" },
  { label: "Activities", href: "/farms#activities" },
  { label: "Machinery", href: "/farms#machinery" },
  { label: "Workers", href: "/farms#workers" },
  { label: "Produce listings", href: "/products" },
  { label: "Orders", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Reports", href: "/reports" },
];

const supplierLinks: RoleNavigationLink[] = [
  { label: "Inventory", href: "/inventory" },
  { label: "Stock locations", href: "/inventory#locations" },
  { label: "Stock movements", href: "/inventory#movements" },
  { label: "Products", href: "/products" },
  { label: "Customer orders", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Reports", href: "/reports" },
];

const buyerLinks: RoleNavigationLink[] = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Cart", href: "/cart" },
  { label: "Orders", href: "/orders" },
  { label: "Saved products", href: "/saved-products" },
  { label: "Farmers' produce", href: "/marketplace?category=farm_produce" },
  { label: "Agri-Vet suppliers", href: "/marketplace?category=agri_vet" },
  { label: "Messages", href: "/messages" },
];

const adminLinks: RoleNavigationLink[] = [
  { label: "Administration", href: "/admin" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Orders", href: "/orders" },
];

export function getDashboardKind(role: string | null | undefined): DashboardKind {
  if (role === "farmer" || role === "supplier" || role === "admin") return role;
  if (role === "buyer_individual" || role === "buyer_business" || role === "buyer_institution") {
    return "buyer";
  }
  return "unknown";
}

export function getRoleNavigation(role: string | null | undefined): readonly RoleNavigationLink[] {
  switch (getDashboardKind(role)) {
    case "farmer":
      return farmerLinks;
    case "supplier":
      return supplierLinks;
    case "buyer":
      return buyerLinks;
    case "admin":
      return adminLinks;
    default:
      return [];
  }
}

export function getRoleLabel(role: string | null | undefined): string {
  switch (getDashboardKind(role)) {
    case "farmer":
      return "Farmer";
    case "supplier":
      return "Agri-Vet Supplier";
    case "buyer":
      return "Buyer";
    case "admin":
      return "Administrator";
    default:
      return "Account";
  }
}
