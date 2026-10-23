import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { isLoggedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isLoggedIn())) redirect("/login");
  return <Dashboard />;
}
