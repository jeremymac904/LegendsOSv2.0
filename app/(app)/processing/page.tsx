import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProcessingAliasPage() {
  redirect("/flo-processing");
}
