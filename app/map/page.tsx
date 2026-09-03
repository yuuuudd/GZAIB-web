import { BuilderMap } from "../../components/map/BuilderMap";
import { BrandHomeLink } from "../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../components/navigation/PrimaryNavigation";

export default function MapPage() {
  return <main className="brand-shell"><header className="brand-header"><BrandHomeLink /><PrimaryNavigation active="map" /><a className="brand-header-action" href="/me">我的</a></header><BuilderMap /></main>;
}
