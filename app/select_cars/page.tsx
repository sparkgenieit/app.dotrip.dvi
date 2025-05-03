

export async function generateMetadata({ searchParams }) {
  const from = searchParams?.from_city_name || "Your City";
  const to = searchParams?.to_city_name || "Destination";
  const date = searchParams?.pickup_date || "Today";
  const type = searchParams?.trip_type_label || "Trip";

  return {
    title: `Cabs from ${from} to ${to} | ${type} | doTrip`,
    description: `Compare and book cabs from ${from} to ${to} for your ${type.toLowerCase()} journey on ${date}. Best prices guaranteed!`,
    keywords: `${from} to ${to} cabs, ${type.toLowerCase()} taxi, cab booking, doTrip, ride fare`,
  };
}
import SelectCarsPage from "../../components/SelectCarsPage";

export default function CarsPage() {
  return <SelectCarsPage />;
}
