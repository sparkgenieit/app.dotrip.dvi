import HeroSection from "../components/HeroSection";
import WhyChooseUs from "../components/WhyChooseUs";
import VehicleCategories from "../components/VehicleCategories";
import Testimonials from "../components/Testimonials";
import CallToAction from "../components/CallToAction";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <WhyChooseUs />
      <VehicleCategories />
      <Testimonials />
      <CallToAction />
      <Footer />
    </main>
  );
}
