import Hero from "@/components/Hero";
import PipelineSimulatorLoader from "@/components/PipelineSimulator/Loader";
import ProjectGrid from "@/components/ProjectGrid";
import CapabilityList from "@/components/CapabilityList";
import AboutStrip from "@/components/AboutStrip";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <PipelineSimulatorLoader />
      <ProjectGrid />
      <CapabilityList />
      <AboutStrip />
      <Footer />
    </main>
  );
}
