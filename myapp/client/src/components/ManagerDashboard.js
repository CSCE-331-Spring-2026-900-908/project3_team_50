import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ManagerDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function ManagerDashboard() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    const fetchCollegeStationWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError('');

        const response = await fetch(
          `${API}/weather?city=${encodeURIComponent('College Station')}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch weather data.');
        }

        setWeather(data);
      } catch (err) {
        setWeather(null);
        setWeatherError(err.message || 'Unable to fetch College Station weather.');
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchCollegeStationWeather();
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

        <div className="manager-card disabled-card">
          <h2>Employee Management</h2>
          <p>In progress.</p>
          <span className="manager-card-cta muted">Coming Next</span>
        </div>

        <div className="manager-card disabled-card">
          <h2>Reports</h2>
          <p>In progress.</p>
          <span className="manager-card-cta muted">Coming Next</span>
        </div>
      </div>

      <div className="weather-dashboard-panel">
        <div className="weather-dashboard-header">
          <h2>Current Weather in College Station</h2>
          <p>Live weather data from OpenWeather.</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}