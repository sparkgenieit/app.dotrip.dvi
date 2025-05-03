// app/components/CabBookingForm.tsx

"use client";

import { useState } from "react";

export default function CabBookingForm() {
  const [tripType, setTripType] = useState("AIRPORT");

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-6xl mx-auto mt-10">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        {["ONE WAY", "ROUND TRIP", "LOCAL", "AIRPORT"].map((type) => (
          <button
            key={type}
            onClick={() => setTripType(type)}
            className={`px-4 py-2 rounded font-semibold ${
              tripType === type
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <form className="grid md:grid-cols-6 gap-4">
        {/* Trip Type */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700">
            Trip
          </label>
          <select className="mt-1 block w-full border-gray-300 rounded">
            <option>Drop to Airport</option>
            <option>Pickup from Airport</option>
          </select>
        </div>

        {/* Pickup Address */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Pickup Address
          </label>
          <input
            type="text"
            placeholder="Enter your location"
            className="mt-1 block w-full border-gray-300 rounded"
          />
        </div>

        {/* Drop Airport */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700">
            Drop Airport
          </label>
          <input
            type="text"
            placeholder="Airport or city"
            className="mt-1 block w-full border-gray-300 rounded"
          />
        </div>

        {/* Pickup Date */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700">
            Pickup Date
          </label>
          <input
            type="date"
            defaultValue="2025-05-03"
            className="mt-1 block w-full border-gray-300 rounded"
          />
        </div>

        {/* Pickup Time */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700">
            Pickup Time
          </label>
          <input
            type="time"
            defaultValue="08:00"
            className="mt-1 block w-full border-gray-300 rounded"
          />
        </div>
      </form>

      <div className="text-center mt-6">
        <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded">
          EXPLORE CABS
        </button>
      </div>
    </div>
  );
}
