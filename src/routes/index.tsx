import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "../apflow/dashboard";
import { ApFlowPage } from "../apflow/route-page";

export const Route = createFileRoute("/")({ component: HomePage });
function HomePage() { return <ApFlowPage><Dashboard /></ApFlowPage>; }
