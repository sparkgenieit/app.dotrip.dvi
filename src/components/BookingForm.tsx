'use client';
import { useState, useEffect } from 'react';
import { loginWithEnvCredentials, fetchWithRefresh } from '../utils/auth';

export default function BookingForm({ vehicleId }: { vehicleId: number }) {
  const [formData, setFormData] = useState({
    userId: 1,
    fromCityId: '',
    toCityId: '',
    pickupDateTime: '',
    tripTypeId: '',
    fare: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loginWithEnvCredentials().catch(err => {
      console.error('Login failed on mount:', err);
      setMessage('Login failed.');
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithRefresh('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          vehicleId: vehicleId || 1,
          fare: parseFloat(formData.fare),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage('Booking successful! Booking ID: ' + data.id);
      } else {
        const err = await res.json();
        setMessage('Booking failed: ' + err.message);
      }
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-100 rounded">
      <input name="fromCityId" placeholder="From City ID" onChange={handleChange} className="block mb-2 p-2 w-full" />
      <input name="toCityId" placeholder="To City ID" onChange={handleChange} className="block mb-2 p-2 w-full" />
      <input name="pickupDateTime" placeholder="Pickup DateTime (YYYY-MM-DDTHH:mm:ssZ)" onChange={handleChange} className="block mb-2 p-2 w-full" />
      <input name="tripTypeId" placeholder="Trip Type ID" onChange={handleChange} className="block mb-2 p-2 w-full" />
      <input name="fare" placeholder="Fare" onChange={handleChange} className="block mb-2 p-2 w-full" />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Book Now</button>
      {message && <p className="mt-4">{message}</p>}
    </form>
  );
}
