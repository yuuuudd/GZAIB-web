import Link from "next/link";
import { ActivityProposalForm } from "../../../components/activities/ActivityProposalForm";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";

export default function ActivityProposalPage() {
  return <main className="content-hub-shell"><header className="brand-header content-hub-header"><BrandHomeLink /><PrimaryNavigation active="events" /><Link className="brand-header-action" href="/me/activities">我的活动申请</Link></header><div className="activity-proposal-shell"><ActivityProposalForm /></div></main>;
}
