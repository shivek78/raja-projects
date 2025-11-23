"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MAP_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function DashboardPage() {
  // base state
  const [user, setUser] = useState<any | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const [userLocation, setUserLocation] = useState<any | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [algorithmResults, setAlgorithmResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [address, setAddress] = useState("");
  const [distance, setDistance] = useState("");

  // favorites stored in DB per-user
  const [favorites, setFavorites] = useState<number[]>([]);

  // battery & planner state
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState<number>(75);
  const [currentSoC, setCurrentSoC] = useState<number>(50);
  const [targetSoC, setTargetSoC] = useState<number>(90);
  const [consumptionWhPerKm, setConsumptionWhPerKm] = useState<number>(180);

  // ui
  const [dark, setDark] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [map3d, setMap3d] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // map refs
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);

  // --- user + prefs load
  useEffect(() => {
    async function fetchMe() {
      setUserLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user ?? null);
          setFavorites(data.user?.favorites ?? []);
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
      }
      setUserLoading(false);
    }
    fetchMe();
  }, []);

  // persist theme pref to server (best-effort)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (!user) return;
    const t = setTimeout(() => {
      fetch("/api/user/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: dark ? "dark" : "light" }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [dark, user]);

  // --- map init
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAP_TOKEN) return;
    mapboxgl.accessToken = MAP_TOKEN;
    const map = (mapInstance.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: dark ? "mapbox://styles/mapbox/dark-v10" : "mapbox://styles/mapbox/light-v10",
      center: userLocation ? [userLocation.lng, userLocation.lat] : [75.8577, 30.9010],
      zoom: userLocation ? 13 : 11,
    }));
    map.addControl(new mapboxgl.NavigationControl());
    map.on("load", () => updateMapMarkers(stations, userLocation));
    return () => map.remove();
  }, [MAP_TOKEN, dark]);

  useEffect(() => {
    if (mapInstance.current && userLocation) {
      mapInstance.current.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 13 });
      updateMapMarkers(stations, userLocation);
    }
  }, [userLocation, stations]);

  // helpers
  function clearMarkers() {
    document.querySelectorAll(".ev-marker").forEach((el) => el.remove());
  }
  function clusterStations(list: any[]) {
    const groups: Record<string, any> = {};
    list.forEach((s) => {
      const key = `${Number(s.lat).toFixed(2)}-${Number(s.lng).toFixed(2)}`;
      groups[key] ??= { lat: s.lat, lng: s.lng, stations: [] };
      groups[key].stations.push(s);
    });
    return Object.values(groups).map((g) => ({ ...g, count: g.stations.length }));
  }
  function updateMapMarkers(stationsList: any[], centerLocation: any) {
    if (!mapInstance.current) return;
    clearMarkers();
    const clusters = clusterStations(stationsList);
    clusters.forEach((c) => {
      const el = document.createElement("div");
      el.className = "ev-marker";
      el.style.width = c.count > 1 ? "32px" : "18px";
      el.style.height = c.count > 1 ? "32px" : "18px";
      el.style.borderRadius = "50%";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "#1d1919ff";
      el.style.background = c.count > 1 ? "linear-gradient(135deg,#6366f1,#22c55e)" : "#1a2144ff";
      el.style.boxShadow = "0 6px 18px rgba(26, 31, 49, 0.25)";
      if (c.count > 1) el.textContent = String(c.count);

      new mapboxgl.Marker(el).setLngLat([c.lng, c.lat]).addTo(mapInstance.current!);
      el.addEventListener("click", () => {
        if (c.count > 1)
          mapInstance.current!.easeTo({ center: [c.lng, c.lat], zoom: mapInstance.current!.getZoom() + 2 });
        else {
          const s = c.stations[0];
          const elItem = document.getElementById(`station-${s.id}`);
          if (elItem) elItem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });

    if (centerLocation) {
      const userEl = document.createElement("div");
      userEl.className = "ev-marker";
      userEl.style.width = "14px";
      userEl.style.height = "14px";
      userEl.style.borderRadius = "50%";
      userEl.style.background = "#ef4444";
      new mapboxgl.Marker(userEl).setLngLat([centerLocation.lng, centerLocation.lat]).addTo(mapInstance.current!);
    }
  }

  // --- main search + analysis
  async function findStationsAndAnalyze(location: any, distanceArg: any) {
    setError("");
    setLoading(true);
    try {
      const stationsResponse = await fetch(
        `/api/stations?lat=${location.lat}&lng=${location.lng}&distance=${distanceArg || 25}`
      );
      if (!stationsResponse.ok) throw new Error(await stationsResponse.text());
      const stationsData = await stationsResponse.json();
      setStations(stationsData.stations || []);
      if ((stationsData.stations || []).length) {
        const algorithmResponse = await fetch("/api/find-best-station", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userLocation: location, stations: stationsData.stations }),
        });
        if (algorithmResponse.ok) {
          const algorithmData = await algorithmResponse.json();
          setAlgorithmResults(algorithmData);
        }
      }
      updateMapMarkers(stationsData.stations || [], location);
    } catch (err: any) {
      setError(err.message || "Failed to analyze stations");
    } finally {
      setLoading(false);
    }
  }

  // geolocation helpers
  async function getCurrentLocation() {
    try {
      setLoading(true);
      setError("");

      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      setUserLocation(loc);
      await findStationsAndAnalyze(loc, Number(distance));
    } catch (err: any) {
      console.error("Geolocation Error:", err);

      // GeolocationPositionError codes:
      // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (err?.code === 1) setError("Location permission denied.");
      else if (err?.code === 2) setError("Location unavailable.");
      else if (err?.code === 3) setError("Location request timed out.");
      else setError("Could not get location");
    } finally {
      setLoading(false);
    }
  }

  async function searchByAddress() {
    if (!address.trim()) {
      setError("Enter address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "Geocode failed");
        throw new Error(txt || "Geocode failed");
      }
      const body = await res.json();
      if (body.error) throw new Error(body.error || "Geocode failed");
      const loc = { lat: body.lat, lng: body.lng };
      setUserLocation(loc);
      await findStationsAndAnalyze(loc, Number(distance));
    } catch (e: any) {
      setError(e?.message || "Geocode failed");
    } finally {
      setLoading(false);
    }
  }

  // --- favorites (server-backed)
  async function toggleFavorite(sid: number) {
    if (!user) {
      alert("Please login to save favorites");
      return;
    }
    const isFav = favorites.includes(sid);
    try {
      const res = await fetch("/api/user/favorite", {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: sid }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFavorites(data.favorites || []);
    } catch (e) {
      console.warn("fav error", e);
    }
  }

  // --- open directions helper
  function openDirections(s: any) {
    if (s.lat && s.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
      window.open(url, "_blank");
    } else if (s.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
      window.open(url, "_blank");
    } else {
      alert("No location available for this station");
    }
  }

  // --- logout
  async function logout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      // If logout endpoint returns OK, redirect. If not, still try to redirect but warn.
      if (res.ok) {
        window.location.href = "/login";
      } else {
        console.warn("Logout response not OK:", await res.text());
        window.location.href = "/login";
      }
    } catch (e) {
      console.error("Logout error:", e);
      window.location.href = "/login";
    }
  }

  // --- polling for real-time updates (simple)
  useEffect(() => {
    if (!pollingEnabled) return;
    const id = setInterval(async () => {
      if (!userLocation) return;
      try {
        const res = await fetch(
          `/api/stations?lat=${userLocation.lat}&lng=${userLocation.lng}&distance=${distance || 25}`
        );
        if (res.ok) {
          const d = await res.json();
          setStations(d.stations || []);
        }
      } catch {}
    }, 20000);
    return () => clearInterval(id);
  }, [pollingEnabled, userLocation, distance]);

  // small synth helper
  function synthesizeThreads() {
    if (!algorithmResults) return [];
    if (algorithmResults.explanation?.threads) return algorithmResults.explanation.threads;
    return (algorithmResults.explanation?.details || []).slice(0, 4).map((d: any) => ({ role: d.algorithm, text: d.reasoning }));
  }

  // UI render (root wrapper)
  return (
    <div className={`min-h-screen ${dark ? "bg-slate-900 text-slate-100" : "bg-gradient-to-br from-blue-600 via-teal-500 to-indigo-500 text-slate-900"}`}>
      {/* Top header (glass) */}
      <header
        className={`w-full sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 shadow-lg ${
          dark ? "bg-black/30" : "bg-white/20"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="logo" className="w-11 h-11 rounded-xl object-cover shadow-lg" />
            <div className="text-xl font-semibold bg-gradient-to-r from-cyan-300 to-blue-400 text-transparent bg-clip-text">
              EV Station Finder
            </div>
          </div>

          {/* Center Search Bar */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl flex items-center gap-2">
              <Input
                placeholder="Search address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-white/10 text-white placeholder-white/60 border-white/20"
              />
              <Input
                placeholder="distance km"
                className="w-28 bg-white/10 text-white placeholder-white/60 border-white/20"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
              <Button onClick={searchByAddress} className="bg-gradient-to-r from-white to-teal-400 text-black font-semibold shadow-lg hover:opacity-90">
                Search
              </Button>
              <Button onClick={getCurrentLocation} variant="outline" className="bg-gradient-to-r from-blue-500 to-teal-400 text-black font-semibold shadow-lg hover:opacity-90">
                Use current
              </Button>
            </div>
          </div>

          {/* Right: User Info + Theme Toggle */}
          <div className="flex items-center gap-4">
            {/* Theme Switch */}
            <button onClick={() => setDark((d) => !d)} className="px-3 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 transition shadow-lg">
              {dark ? "🌙" : "☀️"}
            </button>

            {/* User Profile */}
            {userLoading ? (
              <div className="w-9 h-9 rounded-full bg-white/20 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-black font-bold shadow">
                  {user.name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="text-md font-medium text-white/90">{user.name}</div>

                <Button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg shadow">
                  Logout
                </Button>
              </div>
            ) : (
              <a href="/login" className="bg-teal-500 px-4 py-1 rounded-lg shadow text-white">
                Login
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Banner video */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <video src="/dashboard-banner.mp4" autoPlay loop muted playsInline className="w-full h-[260px] object-cover" />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Map left */}
        <section className="md:col-span-3 space-y-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden h-[640px] shadow-2xl bg-white/10 border border-white/20">
            <div className="flex items-center justify-between p-3">
              <div className="text-white font-semibold">🗺 Map</div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setMap3d((m) => !m)} size="sm">{map3d ? "3D" : "2D"}</Button>
                <Button onClick={() => setPollingEnabled((p) => !p)} size="sm" variant="outline">{pollingEnabled ? "Live" : "Paused"}</Button>
              </div>
            </div>
            <div className="h-full" ref={mapContainer} />
          </motion.div>

          {/* Nearby stations */}
          <section>
            <h2 className="text-white text-lg font-semibold mb-3">📋 Nearby Stations ({stations.length})</h2>
            <div className="w-full rounded-2xl overflow-hidden mb-4 border border-white/10 shadow-lg">
              <video src="/nearby-stations.mp4" autoPlay loop muted playsInline className="w-full h-40 object-cover" />
            </div>

            <div className="grid gap-3">
              {stations.length === 0 && <div className="text-white/80">No stations — search a location to load stations.</div>}
              {stations.map((s: any, i: number) => {
                const inFav = favorites.includes(s.id);
                return (
                  <motion.div id={`station-${s.id ?? i}`} key={s.id ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`p-3 rounded-xl border ${s.isBest ? "border-green-400 bg-green-50/10" : "border-white/10"} flex justify-between items-start`}>
                    <div>
                      <div className="text-white font-semibold flex items-center gap-3">{s.name}
                        <button onClick={() => toggleFavorite(s.id)} className="ml-2 text-sm">{inFav ? "❤️" : "🤍"}</button>
                      </div>
                      <div className="text-xs text-white/70">{s.address}</div>
                      <div className="mt-2 flex gap-2 items-center text-xs text-white/80">
                        <Badge>{s.powerKw ? `${s.powerKw} kW` : "—"}</Badge>
                        <div>📍 {s.distance}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button onClick={() => openDirections(s)} size="sm">Navigate</Button>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(s.address || ""); }}>Copy</Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </section>

        {/* Right col */}
        <aside className="md:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl p-4 bg-white/10 border-white/10">
              <CardHeader><CardTitle className="text-white">💬 AI Insights</CardTitle></CardHeader>
              <CardContent>
                {synthesizeThreads().length === 0 ? <div className="text-white/80">No analysis yet</div> :
                  synthesizeThreads().map((t: any, idx: number) => <div key={idx} className="p-2 rounded-md bg-white/5 mb-2 text-sm">{t.role}: {t.text}</div>)}
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => setAiModalOpen(true)} variant="outline">Open Explanation</Button>
                  <Button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(algorithmResults || {})); }} variant="ghost">Copy JSON</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl p-4 bg-white/10 border-white/10">
              <CardHeader><CardTitle className="text-white">🔎 Quick Metrics</CardTitle></CardHeader>
              <CardContent>
                <div className="text-white/90">Stations <strong>{stations.length}</strong></div>
                <div className="text-white/90">Range <strong>{Math.floor(((currentSoC / 100) * batteryCapacityKwh * 1000) / consumptionWhPerKm)} km</strong></div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex gap-2"><Input type="number" value={batteryCapacityKwh} onChange={(e) => setBatteryCapacityKwh(Number(e.target.value) || 0)} className="w-24" /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl p-4 bg-white/10 border-white/10 overflow-y-auto max-h-[420px]">
              <CardHeader><CardTitle className="text-white">🧠 Algorithm Breakdown</CardTitle></CardHeader>
              <CardContent>
                {!algorithmResults ? <div className="text-white/80">No results yet</div> :
                  algorithmResults.explanation.details.map((d: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl mb-3 bg-white/5">
                      <div className="flex justify-between"><div className="font-semibold text-white">{d.algorithm}</div><div className="text-white/80">{d.score}</div></div>
                      <div className="text-xs text-white/70 mt-2">{d.reasoning}</div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </motion.div>
        </aside>
      </main>

      {/* footer */}
      <footer className="py-4 text-center text-white/60">
        Made by Raju Kumar Sahani
      </footer>

      {/* ai modal */}
      {aiModalOpen && algorithmResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAiModalOpen(false)} />
          <div className="relative max-w-2xl w-full rounded-xl p-4 bg-white/95">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">AI Explanation</h3>
              <button onClick={() => setAiModalOpen(false)}>Close</button>
            </div>
            <pre className="max-h-[60vh] overflow-y-auto text-xs">{JSON.stringify(algorithmResults, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
