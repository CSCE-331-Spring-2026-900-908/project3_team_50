import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ManagerDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function ManagerDashboard() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    const fetchCurrentLocationWeather = () => {
      if (!navigator.geolocation) {
        setWeatherError('Geolocation is not supported by this browser.');
        setWeatherLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            const response = await fetch(
              `${API}/weather/current?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Failed to fetch weather data.');
            }

            setWeather(data);
            setWeatherError('');
          } catch (err) {
            setWeather(null);
            setWeatherError(err.message || 'Unable to fetch local weather.');
          } finally {
            setWeatherLoading(false);
          }
        },
        (error) => {
          let message = 'Unable to retrieve your location.';

          if (error.code === 1) {
            message = 'Location access was denied. Please allow location access and refresh.';
          } else if (error.code === 2) {
            message = 'Your location is unavailable right now.';
          } else if (error.code === 3) {
            message = 'Location request timed out. Please refresh and try again.';
          }

          setWeatherError(message);
          setWeatherLoading(false);
        }
      );
    };

    fetchCurrentLocationWeather();
  }, []);

  return (
    <div className="manager-dashboard">
      <div className="manager-header">
        <h1>Manager Dashboard</h1>
      </div>

      <div className="manager-grid">
        <Link to="/menu-management" className="manager-card active-card">
          <h2>Menu Management</h2>
          <p>View, add, update, and delete menu items.</p>
          <span className="manager-card-cta">Open Page</span>
        </Link>

        <Link to="/inventory-management" className="manager-card active-card">
          <h2>Inventory Management</h2>
          <p>View, add, update, and delete inventory items.</p>
          <span className="manager-card-cta">Open Page</span>
        </Link>

        <div className="manager-card active-card">
          <h2>Weather Service</h2>
          <p>Current local weather is shown below.</p>
          <span className="manager-card-cta">Live Widget</span>
        </div>

        <div className="manager-card disabled-card">
          <h2>Reports</h2>
          <p>In progress.</p>
          <span className="manager-card-cta muted">Coming Next</span>
        </div>
      </div>

      <div className="weather-dashboard-panel">
        <div className="weather-dashboard-header">
          <h2>Current Local Weather</h2>
          <p>Based on your current browser location.</p>
        </div>

        {weatherLoading && (
          <div className="weather-dashboard-state">
            <p>Loading weather...</p>
          </div>
        )}

        {!weatherLoading && weatherError && (
          <div className="weather-dashboard-state weather-dashboard-error">
            <p>{weatherError}</p>
          </div>
        )}

        {!weatherLoading && !weatherError && weather && (
          <div className="weather-dashboard-card">
            <div className="weather-main-row">
              <div>
                <h3>{weather.city}</h3>
                <p className="weather-description">{weather.description}</p>
              </div>
              <div className="weather-temp-block">
                <span className="weather-temp">{Math.round(weather.temperature)}°F</span>
                <span className="weather-condition">{weather.condition}</span>
              </div>
            </div>

            <div className="weather-details-grid">
              <div className="weather-detail-item">
                <span className="weather-detail-label">Feels Like</span>
                <span className="weather-detail-value">{Math.round(weather.feelsLike)}°F</span>
              </div>

              <div className="weather-detail-item">
                <span className="weather-detail-label">Humidity</span>
                <span className="weather-detail-value">{weather.humidity}%</span>
              </div>

              <div className="weather-detail-item">
                <span className="weather-detail-label">Wind Speed</span>
                <span className="weather-detail-value">{weather.windSpeed} mph</span>
              </div>

              <div className="weather-detail-item">
                <span className="weather-detail-label">Coordinates</span>
                <span className="weather-detail-value">
                  {weather.latitude.toFixed(2)}, {weather.longitude.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}