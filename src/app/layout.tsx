import "./globals.css";
export const metadata = { title: "Manajemen Servis" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="id"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><main>{children}</main></body></html>);
}
