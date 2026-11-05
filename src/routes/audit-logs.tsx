import { createFileRoute } from "@tanstack/react-router";
import { PageScreen } from "../apflow/screens";
import { ApFlowPage } from "../apflow/route-page";

export const Route = createFileRoute("/audit-logs")({ component: Page });
function Page() { return <ApFlowPage><PageScreen kind="audit-logs" /></ApFlowPage>; }
