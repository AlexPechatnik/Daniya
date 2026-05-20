import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileCTA } from "@/components/MobileCTA";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="pb-24 lg:pb-0">{children}</main>
      <Footer />
      <MobileCTA />
    </>
  );
}
