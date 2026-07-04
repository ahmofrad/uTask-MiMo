import { redirect } from "next/navigation";

// The middleware should redirect to the appropriate locale.
// This fallback ensures we always have a valid path.
export default function RootPage() {
  redirect("/login");
}
