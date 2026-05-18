import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Leadership from "@/components/Leadership";
import Services from "@/components/Services";
import Skills from "@/components/Skills";
import GameSection from "@/components/GameSection";
import Contact from "@/components/Contact";
import ScrollProgress from "@/components/ScrollProgress";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <About />
      <Projects />
      <Experience />
      <Leadership />
      <Services />
      <Skills />
      <GameSection />
      <Contact />
    </div>
  );
};

export default Index;
