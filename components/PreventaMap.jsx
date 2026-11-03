import React, { useEffect, useState } from 'react';
import GoogleMapReact from 'google-map-react';

// Simple marker component
const Marker = ({ color, text }) => (
  <div
    style={{
      color: '#fff',
      background: color,
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      textAlign: 'center',
    }}
  >
    {text}
  </div>
);

export default function PreventaMap({ assignedIds }) {
  const [sellerPos, setSellerPos] = useState({ lat: -12.0464, lng: -77.0428 }); // default Lima
  const [bodegas, setBodegas] = useState([]);

  // Watch seller position
  useEffect(() => {
    const watcher = navigator.geolocation.watchPosition(
      pos => {
        setSellerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      err => console.error(err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 6000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Load bodegas info (including status)
  useEffect(() => {
    if (!assignedIds?.length) {
      setBodegas([]);
      return;
    }
    const fetchData = async () => {
      const res = await fetch(
        `/api/preventa/bodegas?ids=${assignedIds.join(',')}`
      );
      const data = (await res.json()) || [];
      setBodegas(data);
    };
    fetchData();
  }, [assignedIds]);

  const handleCheckIn = async bodegaId => {
    const res = await fetch('/api/preventa/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodegaId }),
    });
    if (res.ok) {
      // Refresh status
      setBodegas(prev =>
        prev.map(b =>
          b.id === bodegaId ? { ...b, status: 'OFRECIDO' } : b
        )
      );
    }
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: process.env.NEXT_PUBLIC_GMAPS_KEY }}
        center={sellerPos}
        defaultZoom={13}
      >
        {/* Seller marker */}
        <Marker lat={sellerPos.lat} lng={sellerPos.lng} color="#0000ff" text="Yo" />
        {/* Bodega markers */}
        {bodegas.map(b => (
          <Marker
            key={b.id}
            lat={b.lat}
            lng={b.lng}
            color={b.status === 'OFRECIDO' ? '#00ff00' : '#ffff00'}
            text={b.nombre}
            onClick={() => {
              if (b.status !== 'OFRECIDO') handleCheckIn(b.id);
            }}
          />
        ))}
      </GoogleMapReact>
    </div>
  );
}
