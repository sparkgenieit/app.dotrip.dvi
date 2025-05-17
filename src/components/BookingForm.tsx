// components/BookingForm.tsx
'use client';

import React, { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const tabContent = {
  INCLUSIONS: [
    { text: 'Base Fare and Fuel Charges', icon: '🛣️' },
    { text: 'Driver Allowance', icon: '🧍' },
    { text: 'State Tax & Toll', icon: '🏛️' },
    { text: 'GST (5%)', icon: '💰' },
  ],
  EXCLUSIONS: [
    { text: 'Parking Charges', icon: '🅿️' },
    { text: 'Night Allowance', icon: '🌙' },
    { text: 'Extra KM/Hr Charges', icon: '➕' },
  ],
  'T&C': [
    { text: 'Trip has KM and Hour limits', icon: '📏' },
    { text: 'Night allowance applies 9:45 PM to 6:00 AM', icon: '⏰' },
  ],
};

export default function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Contact & address fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');

  // Autocomplete for pickup
  const [pickupSuggestions, setPickupSuggestions] = useState<
    { description: string; place_id: string }[]
  >([]);
  const pickupController = useRef<AbortController | null>(null);
  const pickupSession = useRef(uuidv4());

  // Autocomplete for drop
  const [dropSuggestions, setDropSuggestions] = useState<
    { description: string; place_id: string }[]
  >([]);
  const dropController = useRef<AbortController | null>(null);
  const dropSession = useRef(uuidv4());

  // Tab state
  const [activeTab, setActiveTab] = useState<keyof typeof tabContent>('INCLUSIONS');

  // Lookup existing user on email blur
  async function handleEmailBlur() {
    if (!email.trim()) return;
    try {
      const res = await fetchWithRefresh('/users/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setName('');
        setMobile('');
        return;
      }
      const user = await res.json();
      setName(user.name);
      setMobile(user.phone || '');
    } catch (err) {
      console.error('Email lookup failed', err);
    }
  }

  // Fetch pickup suggestions
  async function fetchPickupSuggestions(input: string) {
    pickupController.current?.abort();
    pickupController.current = new AbortController();
    try {
      const res = await fetchWithRefresh(
        `/places/autocomplete?input=${searchParams.get('from_city_name')} ${encodeURIComponent(input)}&sessiontoken=${pickupSession.current}`,
        { signal: pickupController.current.signal }
      );
      if (!res.ok) throw new Error('Network error');
      setPickupSuggestions(await res.json());
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
      setPickupSuggestions([]);
    }
  }

  // Fetch drop suggestions
  async function fetchDropSuggestions(input: string) {
    dropController.current?.abort();
    dropController.current = new AbortController();
    try {
      const res = await fetchWithRefresh(
        `/places/autocomplete?input=${searchParams.get('to_city_name')} ${encodeURIComponent(input)}&sessiontoken=${dropSession.current}`,
        { signal: dropController.current.signal }
      );
      if (!res.ok) throw new Error('Network error');
      setDropSuggestions(await res.json());
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
      setDropSuggestions([]);
    }
  }

  // Handlers for inputs
  function handlePickupChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setPickup(val);
    if (val.trim().length >= 2) fetchPickupSuggestions(val);
    else setPickupSuggestions([]);
  }
  function choosePickupSuggestion(desc: string) {
    setPickup(desc);
    setPickupSuggestions([]);
  }
  function handleDropChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDrop(val);
    if (val.trim().length >= 2) fetchDropSuggestions(val);
    else setDropSuggestions([]);
  }
  function chooseDropSuggestion(desc: string) {
    setDrop(desc);
    setDropSuggestions([]);
  }

  // Submit: check/update/create user, create addresses, then booking
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // 1️⃣ Ensure user
      let user;
      const checkRes = await fetchWithRefresh('/users/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (checkRes.ok) {
        user = await checkRes.json();
        // update existing user
        const upd = await fetchWithRefresh(`/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone: mobile }),
        });
        if (!upd.ok) throw new Error('Failed to update user');
        user = await upd.json();
      } else {
        // create new user
        const crt = await fetchWithRefresh('/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone: mobile }),
        });
        if (!crt.ok) throw new Error('Failed to create user');
        user = await crt.json();
      }

    
      // 4️⃣ Create booking with pickupId & dropId
      const bookingPayload = {
        userId: user.id,
        vehicleId: Number(searchParams.get('vehicleId') || 0),
        fromCityId: Number(searchParams.get('from_city_id') || 0),
        toCityId: Number(searchParams.get('to_city_id') || 0),
        pickupDateTime: new Date(
          `${searchParams.get('pickup_date')}T${searchParams.get('pickup_time')}`
        ).toISOString(),
        tripTypeId: Number(searchParams.get('trip_type_id') || 0),
        fare: Number(searchParams.get('fare') || 0),
        pickupAddress: pickup,
        dropAddress: drop,
      };
      const bookingRes = await fetchWithRefresh('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });
      if (!bookingRes.ok) throw new Error('Failed to create booking');
      const booking = await bookingRes.json();

      // Redirect to confirmation
      router.push(`/booking-confirmation/?id=${booking.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred');
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-4 md:px-8 py-10">
        <h1 className="text-3xl font-bold text-center mb-10">Book Your Ride</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LEFT (Contact & Pickup) */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
              <h2 className="text-lg font-bold border-b-2 border-blue-200 pb-2 mb-6 uppercase">
                Contact & Pickup Details
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5 text-sm">
                {/* EMAIL */}
                <div>
                  <label className="font-semibold block mb-1">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="Enter your email here"
                    className="w-full border border-gray-300 p-3 rounded-md"
                    required
                  />
                </div>

                {/* NAME */}
                <div>
                  <label className="font-semibold block mb-1">NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name here"
                    className="w-full border border-gray-300 p-3 rounded-md"
                    required
                  />
                </div>

                {/* MOBILE */}
                <div>
                  <label className="font-semibold block mb-1">MOBILE</label>
                  <div className="flex gap-3">
                    <select className="border border-gray-300 p-3 rounded-md w-1/3">
                      <option>India (+91)</option>
                    </select>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      placeholder="Enter your phone number"
                      className="w-2/3 border border-gray-300 p-3 rounded-md"
                      required
                    />
                  </div>
                </div>

                {/* PICKUP with autocomplete and Airport link */}
                <div className="relative">
                  <label className="font-semibold block mb-1">PICKUP</label>
                  <input
                    type="text"
                    value={pickup}
                    onChange={handlePickupChange}
                    placeholder="Pickup address"
                    className="w-full border border-gray-300 p-3 rounded-md"
                    autoComplete="off"
                    required
                  />
                  {pickupSuggestions.length > 0 && (
                    <ul className="absolute z-20 bg-white border border-gray-300 rounded-md mt-1 w-full max-h-60 overflow-auto text-sm">
                      {pickupSuggestions.map(s => (
                        <li
                          key={s.place_id}
                          onClick={() => choosePickupSuggestion(s.description)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          {s.description}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-blue-600 text-xs mt-1 underline cursor-pointer">
                    Airport pickup?
                  </p>
                </div>

                {/* DROP with autocomplete */}
                <div className="relative">
                  <label className="font-semibold block mb-1">DROP</label>
                  <input
                    type="text"
                    value={drop}
                    onChange={handleDropChange}
                    placeholder="Drop location"
                    className="w-full border border-gray-300 p-3 rounded-md"
                    autoComplete="off"
                    required
                  />
                  {dropSuggestions.length > 0 && (
                    <ul className="absolute z-20 bg-white border border-gray-300 rounded-md mt-1 w-full max-h-60 overflow-auto text-sm">
                      {dropSuggestions.map(s => (
                        <li
                          key={s.place_id}
                          onClick={() => chooseDropSuggestion(s.description)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          {s.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* SUBMIT */}
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-md mt-4"
                >
                  PROCEED
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT (Booking Details & Tabs) */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
              <h2 className="text-lg font-bold border-b-2 border-blue-200 pb-2 mb-4 uppercase">
                Your Booking Details
              </h2>
              <ul className="text-sm space-y-2">
                <li>
                  <strong>Itinerary:</strong> {searchParams.get('from_city_name') || 'Hyderabad'} →{' '}
                  {searchParams.get('to_city_name') || 'Srisailam'}
                </li>
                <li>
                  <strong>Pickup Date:</strong>{' '}
                  {searchParams.get('pickup_date') || '16th May 2025'} at{' '}
                  {searchParams.get('pickup_time') || '7:00 AM'}
                </li>
                <li>
                  <strong>Car Type:</strong> {searchParams.get('car') || 'Wagon R or Equivalent'}
                </li>
                <li>
                  <strong>KMs Included:</strong> {searchParams.get('kms') || '213 km'}
                </li>
                <li>
                  <strong>Total Fare:</strong> ₹ {searchParams.get('fare') || '4637'}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
              <div className="flex gap-2 mb-4">
                {Object.keys(tabContent).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as keyof typeof tabContent)}
                    className={`px-4 py-2 text-sm font-semibold rounded-t ${
                      activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <ul className="text-sm space-y-3">
                {tabContent[activeTab].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
