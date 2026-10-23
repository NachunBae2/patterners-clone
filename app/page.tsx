import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Plans } from "@/components/Plans";
import { BottomCta, Intro } from "@/components/Sections";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="landing lp-root lp-hero-wash relative">
          <Hero />
          <Gallery />
          <Intro />
          <Features />
          <Plans />
          <Faq />
          <BottomCta />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
