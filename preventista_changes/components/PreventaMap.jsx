"use client";
import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Helper to create a colored div icon
const createDivIcon = (label, color) => {
  const html = `
    <div style="
      background-color:${color};
      width:28px;height:28px;border-radius:50%;
      display:flex;justify-content:center;align-items:center;
      color:white;font-weight:bold;font-size:14px;
      border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
    ">${label}</div>`;
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
};

export default function PreventaMap({ assignedIds }) {
  const [map, setMap] = useState(null);
  const [bodegas, setBodegas] = useState([]);

  // Initialize map once
  useEffect(() => {
    const init = L.map('preventa-map', { zoomControl: false }).setView([-12.046374, -77.042793], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(init);
    L.control.zoom({ position: 'topright' }).addTo(init);
    setMap(init);
    return () => {
      init.remove();
    };
  }, []);

  // Load bodegas data when assignedIds change
  useEffect(() => {
    if (!assignedIds?.length) {
      setBodegas([]);
      return;
    }
    const fetchData = async () => {
      const res = await fetch(`/api/preventa/bodegas?ids=${assignedIds.join(',')}`);
      const data = (await res.json()) || [];
      setBodegas(data);
    };
    fetchData();
  }, [assignedIds]);

  // Render markers whenever map and bodegas are ready
  useEffect(() => {
    if (!map) return;
    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    bodegas.forEach((b) => {
      const color = b.status === 'OFRECIDO' ? '#00ff00' : '#ffff00'; // green or yellow
      const label = b.status === 'OFRECIDO' ? '✔' : b.id;
      const marker = L.marker([b.lat, b.lng], { icon: createDivIcon(label, color) }).addTo(map);
      marker.bindPopup(`<b>${b.nombre}</b>`);
      if (b.status !== 'OFRECIDO') {
        marker.on('click', async () => {
          // Mark as offered / visited
          await fetch('/api/preventa/checks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bodegaId: b.id }),
          });
          // Update local state to reflect change
          setBodegas((prev) =>
            prev.map((item) =>
              item.id === b.id ? { ...item, status: 'OFRECIDO' } : item
            )
          );
        });
      }
    });
  }, [map, bodegas]);

  return <div id="preventa-map" style={{ height: '100%', width: '100%' }} />;
}
