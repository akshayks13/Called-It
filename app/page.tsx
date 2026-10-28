import App from "@/components/App";
import { Suspense } from "react";
import { connection } from "next/server";
import { aiEnabled } from "@/lib/ai/config";

async function ConfiguredApp() {
  await connection();
  return <App aiEnabled={aiEnabled()} />;
}

export default function Page() {
  return <Suspense fallback={<App />}><ConfiguredApp /></Suspense>;
}
