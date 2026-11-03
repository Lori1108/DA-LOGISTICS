import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import PreventaMap from '@/components/PreventaMap';

// Simple API helpers – adjust endpoint names if they differ in your backend
const fetchDistricts = async () => {
  const res = await fetch('/api/preventa/districts');
  return res.ok ? res.json() : [];
};

const fetchBodegas = async (district: string) => {
  const res = await fetch(`/api/preventa/bodegas?district=${encodeURIComponent(district)}`);
  return res.ok ? res.json() : [];
};

export default function PreventaDashboard() {
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchDistricts().then(setDistricts);
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetchBodegas(selectedDistrict).then(setBodegas);
    } else {
      setBodegas([]);
    }
  }, [selectedDistrict]);

  const toggleAssign = (id: number) => {
    setAssigned(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const assignAll = () => {
    const allIds = bodegas.map(b => b.id);
    setAssigned(new Set(allIds));
  };

  const saveRoute = async () => {
    const route = Array.from(assigned);
    const res = await fetch('/api/preventa/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodegaIds: route }),
    });
    if (res.ok) alert('Ruta guardada');
    else alert('Error al guardar la ruta');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Panel Preventa</h1>

      <div className="mb-4">
        <label className="mr-2">Distrito:</label>
        <select
          value={selectedDistrict}
          onChange={e => setSelectedDistrict(e.target.value)}
          className="border rounded p-1"
        >
          <option value="">--Selecciona--</option>
          {districts.map(d => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {selectedDistrict && (
        <>
          <button onClick={assignAll} className="bg-blue-500 text-white px-3 py-1 rounded mr-2">
            Asignar todas
          </button>
          <button onClick={saveRoute} className="bg-green-600 text-white px-3 py-1 rounded">
            Guardar Ruta
          </button>
        </>
      )}

      <div className="grid grid-cols-2 gap-4 mt-6">
        {/* Bodegas list */}
        <div className="overflow-y-auto max-h-96 border rounded p-2">
          <h2 className="font-semibold mb-2">Bodegas</h2>
          {bodegas.map(b => (
            <div key={b.id} className="flex items-center justify-between py-1 border-b">
              <span>{b.nombre}</span>
              <input
                type="checkbox"
                checked={assigned.has(b.id)}
                onChange={() => toggleAssign(b.id)}
              />
            </div>
          ))}
        </div>
        {/* Map */}
        <div className="h-96 border rounded">
          <PreventaMap assignedIds={Array.from(assigned)} />
        </div>
      </div>

      <div className="mt-4">
        <Link href="/">
          <a className="text-blue-600 underline">Volver al inicio</a>
        </Link>
      </div>
    </div>
  );
}
