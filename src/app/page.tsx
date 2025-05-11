export const metadata = {
  title: 'Book Your Cab | doTrip Car Rentals',
  description: 'Find affordable and reliable car rentals across India. One-way, round trip, local or airport rides in seconds.',
  keywords: 'car rentals, cabs, one-way trip, airport taxi, book cab, doTrip',
};


import HeroSection from "@/components/HeroSection";
import WhyChooseUs from "@/components/WhyChooseUs";
import VehicleCategories from "@/components/VehicleCategories";
import Testimonials from "@/components/Testimonials";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";

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
