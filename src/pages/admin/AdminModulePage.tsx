type AdminModulePageProps = { title: string; description: string };

export function AdminModulePage({ title, description }: AdminModulePageProps) {
  return <section className="admin-dashboard admin-module-page"><p className="eyebrow">IKKO Homes internal</p><h1>{title}</h1><p>{description}</p></section>;
}
