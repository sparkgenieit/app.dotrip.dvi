'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

const tabContent = {
  INCLUSIONS: ["Base Fare and Fuel Charges", "Driver Allowance", "GST (5%)"],
  EXCLUSIONS: ["Toll / State Tax", "Parking Charges", "Night Allowance"],
  "T&C": [
    "Trip has KM and Hour limits.",
    "Extra KM/Hr charges apply beyond limits.",
    "Night allowance applies 09:45 PM to 06:00 AM.",
  ],
};

export default function BookingForm() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("INCLUSIONS");

  return (
    <div className="p-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
      {/* Left: Contact form */}
      <div className="bg-white rounded shadow p-6 border">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">CONTACT & PICKUP DETAILS</h2>
        <form className="space-y-4">
          <input type="text" placeholder="Enter your name here" className="w-full border p-2 rounded" />
          <input type="email" placeholder="Enter your email here" className="w-full border p-2 rounded" />
          <div className="flex gap-2">
            <select className="border p-2 rounded w-1/3">
              <option>India (+91)</option>
            </select>
            <input type="tel" placeholder="Enter your phone number here" className="w-2/3 border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PICKUP</label>
            <input type="text" placeholder="Enter pickup address" className="w-full border p-2 rounded" />
            <p className="text-blue-600 text-xs mt-1 underline cursor-pointer">Airport pickup?</p>
          </div>
          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded mt-4">
            PROCEED
          </button>
        </form>
      </div>

      {/* Right: Booking summary */}
      <div>
        <div className="bg-white rounded shadow p-6 border mb-4">
          <h2 className="text-md font-semibold mb-4 border-b pb-2">YOUR BOOKING DETAILS</h2>
          <ul className="text-sm space-y-1">
            <li><strong>Pickup City:</strong> {searchParams.get("from_city_name") || "Hyderabad"}</li>
<li><strong>Trip Type:</strong> {searchParams.get("trip_type_label")  || "Local"} (8hr/80 km)</li>
            <li>
              <strong>Pickup Date:</strong> {searchParams.get("pickup_date") || "5th May 2025"} at{" "}
              {searchParams.get("pickup_time") || "7:00 AM"}
            </li>
            <li><strong>Car Type:</strong> {searchParams.get("car") || "Toyota Innova"}</li>
            <li><strong>Total Fare:</strong> ₹ {searchParams.get("fare") || "2717"}</li>
          </ul>

        </div>

        <div className="bg-white rounded shadow p-6 border">
          <div className="flex gap-2 mb-4">
            {Object.keys(tabContent).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded ${
                  activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
            {tabContent[activeTab].map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
