import Image from "next/image";

export default function VehicleCategories() {
  return (
    <section className="py-16 bg-gray-100 text-center">
      <h2 className="text-3xl font-bold mb-8">Explore Our Cars</h2>
      <div className="grid md:grid-cols-3 gap-6 px-4 max-w-6xl mx-auto">
        <div className="bg-white rounded-lg p-4 shadow">
          <Image src="/economy.png" alt="Economy" width={640} height={400} className="rounded mb-4" />
          <h3 className="text-xl font-semibold mb-2">Economy</h3>
          <p>Fuel-efficient cars for daily use.</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <Image src="/suv.png" alt="SUV" width={640} height={400} className="rounded mb-4" />
          <h3 className="text-xl font-semibold mb-2">SUV</h3>
          <p>Spacious and comfortable for family trips.</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <Image src="/luxury.png" alt="Luxury" width={640} height={400} className="rounded mb-4" />
          <h3 className="text-xl font-semibold mb-2">Luxury</h3>
          <p>Ride in style with premium features.</p>
        </div>
      </div>
    </section>
  );
}
