import React, { useState } from 'react';
import './WeatherService.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function WeatherService() {
    const [city, setCity] = useState('College Station');
    const [weather, setWeather] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const key = process.env.REACT_APP_WEATHER_KEY;

    const fetchWeather = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                `${API}/weather?city=${encodeURIComponent(city)}&key=${encodeURIComponent(key)}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch weather');
            }

            setWeather(data);
        } catch (err) {
            setWeather(null);
            setError(err.message || 'Unable to fetch weather');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="weather-service-page">
            <div className="weather-service-header">
                <h1>Weather Service</h1>
                <p>Check the current weather for any city.</p>
            </div>

            <div className="weather-service-search">
                <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter a city"
                />
                <button onClick={fetchWeather}>Get Weather</button>
            </div>

            {loading && <p className="weather-message">Loading weather data...</p>}
            {error && <p className="weather-error">{error}</p>}

            {weather && (
                <div className="weather-card">
                    <h2>{weather.city}</h2>
                    <p><strong>Temperature:</strong> {weather.temperature} °F</p>
                    <p><strong>Feels Like:</strong> {weather.feelsLike} °F</p>
                    <p><strong>Condition:</strong> {weather.condition}</p>
                    <p><strong>Description:</strong> {weather.description}</p>
                    <p><strong>Humidity:</strong> {weather.humidity}%</p>
                    <p><strong>Wind Speed:</strong> {weather.windSpeed} mph</p>
                </div>
            )}
        </div>
    );
}