import { CoCreateSquare } from "../../components/co-create/CoCreateSquare";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

export default function CoCreatePage() {
  return <main className="co-create-shell"><header className="brand-header co-create-header"><BrandHomeLink /><PrimaryNavigation active="co-create" /><a className="brand-header-action" href="/me">我的</a></header><CoCreateSquare /></main>;
}
