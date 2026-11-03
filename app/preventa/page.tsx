"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import PreventaMap from '../../components/PreventaMap';

// Helper to fetch all bodegas (no sector filter, we filter client‑side)
const fetchBodegas = async (): Promise<any[]> => {
  const res = await fetch('/api/preventa/bodegas');
  return res.ok ? await res.json() : [];
};

export default function PreventaDashboard() {
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [assigned, setAssigned] = useState<Set<number>>(new Set());

  // Load bodegas once and derive the list of unique sectors
  useEffect(() => {
    fetchBodegas().then((data) => {
      setBodegas(data);
      const uniq = Array.from(new Set(data.map((b) => b.sector)));
      setSectors(uniq);
    });
  }, []);

  // Apply sector filter (if any)
  const displayed = selectedSector
    ? bodegas.filter((b) => b.sector === selectedSector)
    : bodegas;

  const toggleAssign = (id: number) => {
    setAssigned((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const assignAll = () => {
    const allIds = displayed.map((b) => b.id);
    setAssigned(new Set(allIds));
  };

  const saveRoute = async () => {
    const route = Array.from(assigned);
    const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
    const res = await fetch('/api/preventa/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodegaIds: route, date: today }),
    });
    if (res.ok) alert('Ruta guardada');
    else alert('Error al guardar la ruta');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Panel Preventa</h1>
      <div className="mb-4">
        <label className="mr-2">Sector:</label>
        <select
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="border rounded p-1"
        >
          <option value="">--Todas--</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {displayed.length > 0 && (
        <>
          <button
            onClick={assignAll}
            className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
          >
            Asignar todas
          </button>
          <button
            onClick={saveRoute}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            Guardar Ruta
          </button>
        </>
      )}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {/* Bodegas list */}
        <div className="overflow-y-auto max-h-96 border rounded p-2">
          <h2 className="font-semibold mb-2">Bodegas</h2>
          {displayed.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-1 border-b">
              <span>{b.nombre} ({b.sector})</span>
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
