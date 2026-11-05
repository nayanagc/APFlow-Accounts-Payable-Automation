import { createFileRoute } from "@tanstack/react-router";
import { PageScreen } from "../apflow/screens";
import { ApFlowPage } from "../apflow/route-page";

export const Route = createFileRoute("/goods-receipts")({ component: Page });
function Page() { return <ApFlowPage><PageScreen kind="goods-receipts" /></ApFlowPage>; }
