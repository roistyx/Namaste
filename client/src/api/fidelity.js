export async function getFidelityPositions() {
  const res = await fetch('/api/fidelity/positions');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data;
}

export async function uploadFidelityCSV(csvText) {
  const res = await fetch('/api/fidelity/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: csvText,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data;
}
