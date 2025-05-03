export async function generateMetadata({ searchParams }) {
  const car = searchParams?.car || "Selected Car";
  const city = searchParams?.from_city_name || "Your City";
  const fare = searchParams?.fare || "Best Price";
  const date = searchParams?.pickup_date || "Your Date";

  return {
    title: `Confirm Booking for ${car} | doTrip`,
    description: `You're booking a ${car} from ${city} on ${date}. Total fare is ₹${fare}. Enter your details to confirm your ride.`,
    keywords: `book ${car}, car booking, ${city} taxi, doTrip confirmation, fare ${fare}`,
  };
}

import BookingForm from "../../components/BookingForm";

export default function BookingPage() {
  return <BookingForm />;
}
