'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth'; // ✅ Add at top

export default function HeroSection() {
  const router = useRouter();

  const [tripType, setTripType] = useState("AIRPORT");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("2025-05-05");
  const [pickupTime, setPickupTime] = useState("07:00");

  const [allCities, setAllCities] = useState<string[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);

  const [errors, setErrors] = useState<{ pickup?: string; drop?: string }>({});

  useEffect(() => {
  async function fetchCities() {
    try {
      const res = await fetchWithRefresh('/cities');
      const data = await res.json();
      const cityNames = data.map((city: any) => `${city.name}, ${city.state}`);
      setAllCities(cityNames);
    } catch (err) {
      console.error("City fetch error:", err);
    }
  }
  fetchCities();
}, []);

  const filteredPickup = showPickupSuggestions
    ? pickupLocation.trim() === ""
      ? allCities
      : allCities.filter((city) =>
          city.toLowerCase().includes(pickupLocation.toLowerCase())
        )
    : [];

  const filteredDrop = showDropSuggestions
    ? dropLocation.trim() === ""
      ? allCities
      : allCities.filter((city) =>
          city.toLowerCase().includes(dropLocation.toLowerCase())
        )
    : [];

  const handleSubmit = () => {
    const validationErrors: typeof errors = {};

    if (!pickupLocation.trim()) {
      validationErrors.pickup = "Please select the pickup city";
    }
    if (!dropLocation.trim()) {
      validationErrors.drop = "Please select the drop city";
    }

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    const params = new URLSearchParams({
      from_city_name: pickupLocation,
      to_city_name: dropLocation,
      trip_sub_type: tripType.toLowerCase().replace(" ", ""),
      trip_type_label: tripType,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
    });

    router.push(`/select_cars?${params.toString()}`);
  };

  return (
    <section
      className="bg-[url('/hero-car-bg.png')] bg-cover bg-center text-white py-24 px-4"
      style={{
        backgroundBlendMode: 'darken',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
    >
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Find the Perfect Ride</h1>
        <p className="text-lg mb-8">Book your car in seconds, drive it for days.</p>

        <div className="bg-white text-black shadow-lg rounded-xl p-6 w-full max-w-6xl mx-auto mt-10">
          <div className="flex justify-center items-center mb-6 flex-wrap gap-2">
            {["ONE WAY", "ROUND TRIP", "LOCAL", "AIRPORT"].map((type) => (
              <button
                key={type}
                onClick={() => setTripType(type)}
                className={`px-4 py-2 rounded font-semibold transition ${
                  tripType === type
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <form
            className="grid md:grid-cols-6 gap-4 relative z-10"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {/* Pickup Location */}
            <div className="col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700">FROM</label>
              <input
                type="text"
                placeholder="Enter Pickup Location"
                className={`mt-1 block w-full border rounded text-black px-3 py-2 ${
                  errors.pickup ? 'border-red-500' : 'border-gray-300'
                }`}
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                onFocus={() => setShowPickupSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 100)}
              />
              {errors.pickup && (
                <p className="text-red-600 text-xs mt-1">{errors.pickup}</p>
              )}
              {showPickupSuggestions && (
                <ul className="absolute z-50 bg-white border border-gray-300 w-full mt-1 rounded max-h-40 overflow-y-auto shadow text-sm">
                  {filteredPickup.map((city) => (
                    <li
                      key={`pickup-${city}`}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onMouseDown={() => {
                        setPickupLocation(city);
                        setShowPickupSuggestions(false);
                        setErrors((prev) => ({ ...prev, pickup: undefined }));
                      }}
                    >
                      {city}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Drop Location */}
            <div className="col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700">TO</label>
              <input
                type="text"
                placeholder="Enter Drop Location"
                className={`mt-1 block w-full border rounded text-black px-3 py-2 ${
                  errors.drop ? 'border-red-500' : 'border-gray-300'
                }`}
                value={dropLocation}
                onChange={(e) => setDropLocation(e.target.value)}
                onFocus={() => setShowDropSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDropSuggestions(false), 100)}
              />
              {errors.drop && (
                <p className="text-red-600 text-xs mt-1">{errors.drop}</p>
              )}
              {showDropSuggestions && (
                <ul className="absolute z-50 bg-white border border-gray-300 w-full mt-1 rounded max-h-40 overflow-y-auto shadow text-sm">
                  {filteredDrop.map((city) => (
                    <li
                      key={`drop-${city}`}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onMouseDown={() => {
                        setDropLocation(city);
                        setShowDropSuggestions(false);
                        setErrors((prev) => ({ ...prev, drop: undefined }));
                      }}
                    >
                      {city}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pickup Date */}
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">PICK UP DATE</label>
              <input
                type="date"
                className="mt-1 block w-full border border-gray-300 rounded text-black px-3 py-2"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>

            {/* Pickup Time */}
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">PICK UP TIME</label>
              <input
                type="time"
                className="mt-1 block w-full border border-gray-300 rounded text-black px-3 py-2"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
          </form>

          <div className="text-center mt-6">
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded"
              onClick={handleSubmit}
            >
              EXPLORE CABS
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
