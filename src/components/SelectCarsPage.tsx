'use client';
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithRefresh } from "../utils/auth";

const tabContent = {
  INCLUSIONS: ["Base Fare", "Driver Allowance", "GST (5%)"],
  EXCLUSIONS: [
    "Pay ₹12/km after 80 km",
    "Pay ₹144/hr after 8 hours",
    "Night Allowance",
    "Toll / State tax",
    "Parking",
  ],
  FACILITIES: ["4 seater", "1 bag", "AC"],
  "T&C": [
    "Your Trip has a KM limit as well as an Hours limit.",
    "Exceeding limits will incur extra charges.",
    "Airport entry charge (if any) is excluded.",
    "Toll, parking, and taxes are extra and paid directly.",
    "Driving between 09:45 PM to 06:00 AM requires night allowance.",
  ],
};

export default function SelectCarsPage() {
  const searchParams = useSearchParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("INCLUSIONS");
  const [cars, setCars] = useState([]);
  const router = useRouter();

  useEffect(() => {
    if (searchParams) {
      setFrom(searchParams.get("from_city_name") || "");
      setTo(searchParams.get("to_city_name") || "");
      setDate(searchParams.get("pickup_date") || "");
      setTime(searchParams.get("pickup_time") || "");
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadCars() {
      try {
        const res = await fetchWithRefresh('/vehicles');
        const data = await res.json();
        setCars(data);
      } catch (err) {
        console.error("Failed to load cars", err);
      }
    }
    loadCars();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">
        {from} → {to} ({searchParams.get("trip_sub_type")?.toUpperCase()})
      </h1>
      <p className="text-gray-600 mb-6">Pick up: {date} at {time}</p>

      <div className="grid gap-6">
        {cars.map((car, index) => (
          <div key={car.id || car.name} className="border rounded-lg shadow hover:shadow-md transition overflow-hidden">
            <div className="grid grid-cols-12 gap-4 items-center p-4">
              <div className="col-span-3 flex items-center gap-4">
                <img src={`cars/${car.image}`} alt={car.name} className="w-20 h-16 object-contain" />
                <div>
                  <h2 className="font-bold text-lg">{car.name}</h2>
                  <p className="text-sm text-gray-500">or equivalent</p>
                </div>
              </div>

              <div className="col-span-5 text-center">
                <p className="text-md font-semibold">Includes 80 km</p>
                <p className="text-sm text-gray-600">and 8 hours</p>
                <button
                  className="text-blue-600 underline text-sm mt-1"
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                >
                  {openIndex === index ? "Hide Details ▲" : "Details ▼"}
                </button>
              </div>

              <div className="col-span-4 text-right">
                <p className="text-sm text-green-600 line-through">₹{car.originalPrice}</p>
                <p className="text-xl font-bold text-blue-600">₹{car.price}</p>
                <p className="text-xs text-gray-500">Inclusive of GST</p>
                <button
                  onClick={() =>
                    router.push(
                      `/booking?from_city_name=${from}&pickup_date=${date}&pickup_time=${time}&car=${encodeURIComponent(
                        car.name
                      )}&fare=${car.price}&trip_type_label=${searchParams.get("trip_type_label") || "Local (8hr/80 km)"}`
                    )
                  }
                  className="mt-2 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                >
                  Select
                </button>
              </div>
            </div>

            {openIndex === index && (
              <div className="border-t px-4 py-4 bg-gray-50">
                <div className="flex gap-2 mb-3 flex-wrap">
                  {Object.keys(tabContent).map((tab) => (
                    <button
                      key={tab}
                      className={`px-3 py-1 border rounded text-sm ${
                        activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200"
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {tabContent[activeTab].map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
