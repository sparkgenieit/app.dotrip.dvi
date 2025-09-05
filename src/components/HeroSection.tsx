'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

// simple id generator for rows
const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function HeroSection() {
  const router = useRouter();

const [tripType, setTripType] = useState("AIRPORT");
const [pickupLocation, setPickupLocation] = useState("");
const [pickupDate, setPickupDate] = useState("2025-05-05");
const [pickupTime, setPickupTime] = useState("07:00");
const [returnDate, setReturnDate] = useState("2025-05-05");

// MULTI-STOP "TO" field
const [toStops, setToStops] = useState<Array<{ id: string; value: string }>>([
  { id: makeId(), value: "" },
]);
const minStops = 1;
const maxStops = 6;

const [allCities, setAllCities] = useState<string[]>([]);
const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
// which TO row's suggestions are open (null = none)
const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);

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

const filteredDrop =
  activeDropIndex !== null
    ? (() => {
        const val = toStops[activeDropIndex]?.value ?? "";
        return val.trim() === ""
          ? allCities
          : allCities.filter((city) =>
              city.toLowerCase().includes(val.toLowerCase())
            );
      })()
    : [];


const handleSubmit = () => {
  const validationErrors: typeof errors = {};

  const toCities = toStops.map((s) => s.value.trim()).filter(Boolean);
  const firstTo = toCities[0] ?? "";

  if (!pickupLocation.trim()) {
    validationErrors.pickup = "Please select the pickup city";
  }
  if (!firstTo) {
    validationErrors.drop = "Please select the drop city";
  }

  setErrors(validationErrors);
  if (Object.keys(validationErrors).length > 0) return;

  const params = new URLSearchParams({
    from_city_name: pickupLocation,
    to_city_name: firstTo, // keeps backward compatibility
    trip_sub_type: tripType.toLowerCase().replace(" ", ""),
    trip_type_label: tripType,
    pickup_date: pickupDate,
    pickup_time: pickupTime,
  });

  if (tripType === "ROUND TRIP" && returnDate) {
    params.set("return_date", returnDate);
  }

  // Optional: pass ALL drops as JSON (backend can ignore if not needed)
  if (toCities.length > 1) {
    params.set("to_cities", JSON.stringify(toCities));
  }

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

        <div className="bg-white text-black shadow-lg rounded-xl p-6 w-full max-w-7xl mx-auto mt-10">
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
              className={`grid ${tripType === "ROUND TRIP" ? "md:grid-cols-7" : "md:grid-cols-6"} gap-4 relative z-10`}
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

            {/* Drop Locations (multi-stop with + / –) */}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">TO</label>
                <span className="text-xs text-gray-500">{toStops.length}/{maxStops}</span>
              </div>

              <div className="space-y-2">
                {toStops.map((row, idx) => (
                  <div key={row.id} className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter Drop Location"
                        className={`flex-1 mt-1 block w-full border rounded text-black px-3 py-2 ${
                          idx === 0 && errors.drop ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={row.value}
                        onChange={(e) => {
                          const next = [...toStops];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setToStops(next);
                        }}
                        onFocus={() => setActiveDropIndex(idx)}
                        onBlur={() => setTimeout(() => setActiveDropIndex(null), 100)}
                        aria-label={`Drop location ${idx + 1}`}
                      />

                      {/* – remove (hide if only one row) */}
                      {toStops.length > minStops && (
                        <button
                          type="button"
                          className="mt-1 h-10 w-9 rounded-md border border-gray-300 text-gray-700"
                          onClick={() =>
                            setToStops((prev) => prev.filter((_, i) => i !== idx))
                          }
                          title="Remove drop"
                          aria-label="Remove drop"
                        >
                          –
                        </button>
                      )}

                      {/* + add (show only on last row) */}
                      {idx === toStops.length - 1 && (
                        <button
                          type="button"
                          className="mt-1 h-10 w-9 rounded-md bg-black text-white"
                          onClick={() => {
                            if (toStops.length >= maxStops) return;
                            setToStops((prev) => [...prev, { id: makeId(), value: "" }]);
                          }}
                          title="Add drop"
                          aria-label="Add drop"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* suggestions dropdown for THIS row */}
                    {activeDropIndex === idx && (
                      <ul className="absolute z-50 bg-white border border-gray-300 w-full mt-1 rounded max-h-40 overflow-y-auto shadow text-sm">
                        {filteredDrop.map((city) => (
                          <li
                            key={`drop-${idx}-${city}`}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={() => {
                              const next = [...toStops];
                              next[idx] = { ...next[idx], value: city };
                              setToStops(next);
                              setActiveDropIndex(null);
                              if (idx === 0) {
                                setErrors((prev) => ({ ...prev, drop: undefined }));
                              }
                            }}
                          >
                            {city}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* only show the error under the first TO field */}
                    {idx === 0 && errors.drop && (
                      <p className="text-red-600 text-xs mt-1">{errors.drop}</p>
                    )}
                  </div>
                ))}
              </div>
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

            {/* Return Date (ROUND TRIP only) */}
            {tripType === "ROUND TRIP" && (
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700">RETURN DATE</label>
                <input
                  type="date"
                  className="mt-1 block w-full border border-gray-300 rounded text-black px-3 py-2"
                  value={returnDate}
                  min={pickupDate || undefined}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
            )}

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
