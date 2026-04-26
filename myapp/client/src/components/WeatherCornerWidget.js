import React, { useEffect, useMemo, useState } from 'react';
import './WeatherCornerWidget.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function iconFor(condition) {
  const value = String(condition || '').toLowerCase();
  if (value.includes('thunder')) return '⛈️';
  if (value.includes('rain') || value.includes('drizzle')) return '🌧️';
  if (value.includes('snow')) return '❄️';
  if (value.includes('cloud')) return '☁️';
  if (value.includes('mist') || value.includes('fog') || value.includes('haze')) return '🌫️';
  if (value.includes('clear')) return '☀️';
  return '🌤️';
}

export default function WeatherCornerWidget({ city = 'College Station' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const encodedCity = useMemo(() => encodeURIComponent(city), [city]);

  useEffect(() => {
    let mounted = true;

    const fetchWeather = async () => {
      try {
        const response = await fetch(`${API}/weather?city=${encodedCity}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Weather fetch failed');
        if (mounted) {
          setWeather(data);
          setError(false);
        }
      } catch {
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchWeather();
    const timer = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [encodedCity]);

  return (
    <aside className="weather-corner-widget" aria-label="Current weather">
      {loading && <span className="weather-corner-line">Loading weather...</span>}
      {!loading && error && <span className="weather-corner-line">Weather unavailable</span>}
      {!loading && !error && weather && (
        <>
          <span className="weather-corner-city">{weather.city}</span>
          <span className="weather-corner-temp">
            {iconFor(weather.condition)} {Math.round(weather.temperature)}F
          </span>
          <span className="weather-corner-condition">{weather.condition}</span>
        </>
      )}
    </aside>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import './WeatherCornerWidget.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function weatherIcon(condition) {
  const value = String(condition || '').toLowerCase();
  if (value.includes('thunder')) return '⛈️';
  if (value.includes('rain') || value.includes('drizzle')) return '🌧️';
  if (value.includes('snow')) return '❄️';
  if (value.includes('cloud')) return '☁️';
  if (value.includes('mist') || value.includes('fog') || value.includes('haze')) return '🌫️';
  if (value.includes('clear')) return '☀️';
  return '🌤️';
}

export default function WeatherCornerWidget({ city = 'College Station' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const query = useMemo(() => encodeURIComponent(city), [city]);

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        setError(false);
        const response = await fetch(`${API}/weather?city=${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Weather fetch failed');
        if (isMounted) setWeather(data);
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();
    const intervalId = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [query]);

  return (
    <aside className="weather-corner-widget" aria-label="Current weather">
      {loading && <span className="weather-corner-line">Weather...</span>}
      {!loading && error && <span className="weather-corner-line">Weather unavailable</span>}
      {!loading && !error && weather && (
        <>
          <span className="weather-corner-line weather-corner-city">{weather.city}</span>
          <span className="weather-corner-line weather-corner-main">
            {weatherIcon(weather.condition)} {Math.round(weather.temperature)}F
          </span>
        </>
      )}
    </aside>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import './WeatherCornerWidget.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function weatherIcon(condition) {
  const value = String(condition || '').toLowerCase();
  if (value.includes('thunder')) return '⛈️';
  if (value.includes('rain') || value.includes('drizzle')) return '🌧️';
  if (value.includes('snow')) return '❄️';
  if (value.includes('cloud')) return '☁️';
  if (value.includes('mist') || value.includes('fog') || value.includes('haze')) return '🌫️';
  if (value.includes('clear')) return '☀️';
  return '🌤️';
}

export default function WeatherCornerWidget({ city = 'College Station' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const query = useMemo(() => encodeURIComponent(city), [city]);

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        setError(false);
        const response = await fetch(`${API}/weather?city=${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Weather fetch failed');
        if (isMounted) setWeather(data);
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();
    const intervalId = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [query]);

  return (
    <aside className="weather-corner-widget" aria-label="Current weather">
      {loading && <span className="weather-corner-line">Weather...</span>}
      {!loading && error && <span className="weather-corner-line">Weather unavailable</span>}
      {!loading && !error && weather && (
        <>
          <span className="weather-corner-line weather-corner-city">{weather.city}</span>
          <span className="weather-corner-line weather-corner-main">
            {weatherIcon(weather.condition)} {Math.round(weather.temperature)}F
          </span>
        </>
      )}
    </aside>
  );
}
