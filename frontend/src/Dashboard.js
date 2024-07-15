import React, { useState, useEffect, useRef } from 'react';
import { Map, Camera, Battery, Clock, Gauge, Flag } from 'lucide-react';

// Define the finish line coordinates (you'll need to adjust these for your specific track)
const FINISH_LINE = {
  minLat: 40.7125,
  maxLat: 40.7130,
  minLng: -74.0065,
  maxLng: -74.0055
};

const CameraFeed = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    async function enableStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing the camera:", err);
      }
    }

    enableStream();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay playsInline muted />
  );
};

const Dashboard = () => {
  const [data, setData] = useState({
    gps: { lat: 0, lng: 0 },
    battery: { voltage: 0, current: 0, power: 0 },
    speed: 0,
    time: new Date().toLocaleTimeString()
  });
  const [showMap, setShowMap] = useState(false);
  const [lapCount, setLapCount] = useState(0);
  const [lastLapTime, setLastLapTime] = useState(null);
  const ws = useRef(null);
  const lastGpsRef = useRef(null);
  const lastTimeRef = useRef(null);

  const checkLapCompletion = (gps) => {
    if (gps.lat >= FINISH_LINE.minLat && gps.lat <= FINISH_LINE.maxLat &&
        gps.lng >= FINISH_LINE.minLng && gps.lng <= FINISH_LINE.maxLng) {
      setLapCount(prevCount => prevCount + 1);
      setLastLapTime(new Date().toLocaleTimeString());
    }
  };

  const calculateSpeed = (currentGps, currentTime) => {
    if (!lastGpsRef.current || !lastTimeRef.current) {
      lastGpsRef.current = currentGps;
      lastTimeRef.current = currentTime;
      return 0;
    }

    const distance = getDistanceFromLatLonInKm(
      lastGpsRef.current.lat,
      lastGpsRef.current.lng,
      currentGps.lat,
      currentGps.lng
    );

    const timeElapsed = (currentTime - lastTimeRef.current) / 1000 / 3600; // convert to hours

    const speed = distance / timeElapsed; // km/h

    lastGpsRef.current = currentGps;
    lastTimeRef.current = currentTime;

    return speed;
  };

  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3001');
    
    ws.current.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      const currentTime = new Date();
      const calculatedSpeed = calculateSpeed(newData.gps, currentTime);
      
      setData(prevData => ({
        ...prevData,
        ...newData,
        time: currentTime.toLocaleTimeString(),
        speed: calculatedSpeed
      }));
      
      checkLapCompletion(newData.gps);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
      // You might want to implement reconnection logic here
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Main display area */}
      <div style={{ width: '100%', height: '100%' }}>
        {showMap ? (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#e6f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Map placeholder (Lat: {data.gps.lat.toFixed(4)}, Lng: {data.gps.lng.toFixed(4)})
          </div>
        ) : (
          <CameraFeed />
        )}
      </div>

      {/* Overlay for metrics */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Clock style={{ marginRight: '0.5rem' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{data.time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Gauge style={{ marginRight: '0.5rem' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{data.speed.toFixed(1)} km/h</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Battery style={{ marginRight: '0.5rem' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            {data.battery.voltage.toFixed(1)}V / {data.battery.current.toFixed(1)}A / {(data.battery.power / 1000).toFixed(1)}kW
          </span>
        </div>
      </div>

      {/* Lap counter overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Flag style={{ marginRight: '0.5rem' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Lap: {lapCount}</span>
        </div>
        {lastLapTime && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Clock style={{ marginRight: '0.5rem' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Last Lap: {lastLapTime}</span>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button 
        style={{ position: 'absolute', bottom: '5rem', right: '1rem', backgroundColor: 'white', color: 'black', padding: '0.5rem', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        onClick={() => setShowMap(!showMap)}
      >
        {showMap ? <Camera /> : <Map />}
      </button>
    </div>
  );
};

export default Dashboard;