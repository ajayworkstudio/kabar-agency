import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { isLoggedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isLoggedIn())) redirect("/login");
  return <Shell>{children}</Shell>;
}
