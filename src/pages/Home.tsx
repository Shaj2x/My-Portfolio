import Layout from "@/components/site/Layout";
import Masthead from "@/components/home/Masthead";
import About from "@/components/home/About";
import Work from "@/components/home/Work";
import Record from "@/components/home/Record";
import Capabilities from "@/components/home/Capabilities";
import PracticeTeaser from "@/components/build/PracticeTeaser";
import ContactSection from "@/components/site/ContactSection";

const Home = () => (
  <Layout title="Shajith Sasikumar — Engineering Science + Ivey HBA">
    <Masthead />
    <About />
    <Work />
    <Record />
    <Capabilities />
    <PracticeTeaser />
    <ContactSection />
  </Layout>
);

export default Home;
