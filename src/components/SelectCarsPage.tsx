'use client';
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchWithRefresh } from "../utils/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const toImageUrl = (p?: string) => {
  if (!p) return '';
  const clean = p.replace(/\\/g, '/').replace(/^\/+/, '');
  return clean.startsWith('http') ? clean : `${API_BASE}/${clean}`;
};

type Car = {
  id?: number;
  name: string;
  image?: string;
  imageUrl: string;
  seats: number;
  bags?: number;
  ac?: boolean;
  price: number;
  originalPrice?: number;
  fuel?: string;
  description?: string;
};

// API shape returned by /vehicle-types
type ApiVehicleType = {
  id: number;
  name: string;
  estimatedRatePerKm: number;
  baseFare: number;
  seatingCapacity: number;
  image?: any;
};

// optional: image mapping (adjust file names in /public/cars if needed)
const IMAGE_MAP: Record<string, string> = {
  Sedan: "sedan.png",
  SUV: "suv.png",
  Hatchback: "hatchback.png",
  "Tempo Traveller": "tempo.png",
};

// pull the first usable URL from the JSON image field
function coverFromImageJson(img: any): string {
  if (!img) return '';
  const first = Array.isArray(img) ? img[0] : img;
  if (typeof first === 'string') return first;
  return first?.url || first?.dataUrl || '';
}

// nice INR formatting
const formatINR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );


const tabs = [
  { key: "INCLUSIONS", label: "Inclusions" },
  { key: "EXCLUSIONS", label: "Exclusions" },
  { key: "FACILITIES", label: "Facilities" },
] as const;

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
};

export default function SelectCarsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from_city_name") || "Your City";
  const to = searchParams.get("to_city_name") || "Destination";
  const date = searchParams.get("pickup_date") || "Today";
  const time = searchParams.get("pickup_time") || "—";
  const tripTypeLabel = searchParams.get("trip_type_label") || "Local (8hr/80 km)";
  const subType = (searchParams.get("trip_sub_type") || tripTypeLabel).toUpperCase();
  const returnDate = searchParams.get("return_date") || "";

// NEW: optional distance for price estimate
const distanceKmParamRaw = searchParams.get("distance_km");
const distanceKmParam = distanceKmParamRaw ? Number(distanceKmParamRaw) : NaN;
const hasDistance = Number.isFinite(distanceKmParam) && distanceKmParam > 0;


  const [cars, setCars] = useState<Car[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("INCLUSIONS");
  const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadCars() {
    try {
      const res = await fetchWithRefresh("/vehicle-types");
      const data: ApiVehicleType[] = await res.json();

      const mapped: Car[] = data.map((v) => {
      const base = v.baseFare ?? 0;
      const rate = v.estimatedRatePerKm ?? 0;
      const estimated = hasDistance ? Math.round(base + rate * distanceKmParam) : base;

      // prefer API-provided image; make it absolute to backend; otherwise fallback to /public/cars/*
      const cover = coverFromImageJson(v.image) || v.image;
      const abs = toImageUrl(cover);
      const fallback = `/cars/${IMAGE_MAP[v.name] ?? "default.png"}`;

      return {
        id: v.id,
        name: v.name,
        imageUrl: abs || fallback,
        seats: v.seatingCapacity,
        price: estimated,
        originalPrice: Math.round(estimated * 1.12),
        fuel: "Included",
        description: `₹${rate}/km after base fare`,
        ac: true,
        bags: 1,
      };
    });

      setCars(mapped);
    } catch (err) {
      console.error("Failed to load cars", err);
    } finally {
      setLoading(false);
    }
  }
  loadCars();
}, [hasDistance, distanceKmParam]);

const continueToBooking = (carName: string, price: number | string) => {
  const params = new URLSearchParams();
  params.set("from_city_name", from);
  params.set("to_city_name", to);
  params.set("pickup_date", date);
  params.set("pickup_time", time);
  params.set("trip_type_label", tripTypeLabel);

  const sub = (searchParams.get("trip_sub_type") || "").trim();
  if (sub) params.set("trip_sub_type", sub);

  if (returnDate) params.set("return_date", returnDate);

  params.set("car", carName);
  params.set("fare", String(price));

  router.push(`/booking?${params.toString()}`);
};

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-5 w-96 bg-gray-200 rounded" />
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          {from} <span className="text-gray-400">→</span> {to}{" "}
          <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
            {subType}
          </span>
        </h1>
        <p className="text-gray-600 mt-1">
          Pick up: <b>{date}</b> at <b>{time}</b> • <span className="text-gray-500">{tripTypeLabel}</span>
        </p>
      </div>

      <div className="grid gap-6">
        {cars.map((car, index) => {
          const selected = openIndex === index;

          return (
            <div
              key={car.id || car.name}
              className={`rounded-2xl border bg-white shadow-sm transition hover:shadow-md overflow-hidden ${
                selected ? "ring-2 ring-blue-500/60" : "ring-1 ring-gray-200"
              }`}
            >
              <div className="grid grid-cols-12 gap-4 items-center p-4">
                <div className="col-span-12 md:col-span-3 flex items-center gap-4">
                  <img
                    src={car.imageUrl}
                    alt={car.name}
                    className="w-24 h-20 object-contain md:w-28 md:h-24"
                    loading="lazy"
                  />

                  <div>
                    <div className="text-lg font-semibold">{car.name}</div>
                    <div className="text-sm text-gray-500">
                      {car.seats} seats {car.ac ? "• AC" : ""} {car.bags ? `• ${car.bags} bag(s)` : ""}
                    </div>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-5">
                  <div className="hidden md:flex items-center gap-2">
                    <span className="inline-block rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200">
                      Fuel: {car.fuel || "Included"}
                    </span>
                    <span className="inline-block rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200">
                      GST Included
                    </span>
                    <span className="inline-block rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200">
                      Verified Driver
                    </span>
                  </div>
                  {car.description && (
                    <p className="mt-2 hidden md:block text-sm text-gray-600">{car.description}</p>
                  )}
                </div>

                <div className="col-span-12 md:col-span-4 md:text-right">
                  {car.originalPrice ? (
                    <p className="text-sm text-green-600 line-through">{formatINR(car.originalPrice)}</p>
                  ) : (
                    <div className="h-5" />
                  )}
                  <p className="text-2xl font-bold text-blue-600 leading-tight">
                    {formatINR(car.price)}
                  </p>

                  <p className="text-xs text-gray-500">Inclusive of GST</p>

                  <div className="mt-3 flex gap-2 md:justify-end">
                    <button
                      onClick={() => setOpenIndex(selected ? null : index)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {selected ? "Hide details" : "View details"}
                    </button>
                    <button
                      onClick={() => continueToBooking(car.name, car.price)}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700"
                    >
                      Select
                    </button>
                  </div>
                </div>
              </div>

              {selected && (
                <div className="border-t bg-gradient-to-b from-white to-gray-50/60 px-4 pb-4">
                  <div className="flex gap-2 pt-4">
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${
                          activeTab === t.key
                            ? "bg-blue-600 text-white ring-blue-600"
                            : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {tabContent[activeTab].map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2 rounded-lg bg-white/60 p-2 text-sm text-gray-700 ring-1 ring-gray-200"
                      >
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Prices shown are estimates. Final fare may vary based on route, tolls, and waiting time.
      </p>
    </div>
  );
}
