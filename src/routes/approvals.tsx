import { createFileRoute } from "@tanstack/react-router";
import { PageScreen } from "../apflow/screens";
import { ApFlowPage } from "../apflow/route-page";

export const Route = createFileRoute("/approvals")({ component: Page });
function Page() { return <ApFlowPage><PageScreen kind="approvals" /></ApFlowPage>; }
