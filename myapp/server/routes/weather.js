const express = require('express');
const router = express.Router();

router.get('/current', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const apiKey = process.env.OPENWEATHER_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing OpenWeather API key in server environment.' });
        }

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required.' });
        }

        const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=imperial&appid=${apiKey}`
        );

        const data = await weatherResponse.json();

        if (!weatherResponse.ok) {
            return res.status(weatherResponse.status).json({
                error: data.message || 'Failed to fetch weather data.',
            });
        }

        return res.json({
            city: data.name,
            temperature: data.main.temp,
            feelsLike: data.main.feels_like,
            humidity: data.main.humidity,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            windSpeed: data.wind.speed,
            latitude: data.coord.lat,
            longitude: data.coord.lon,
        });
    } catch (error) {
        console.error('Weather API error:', error);
        return res.status(500).json({ error: 'Server error while fetching weather data.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const city = req.query.city || 'College Station';
        const apiKey = process.env.OPENWEATHER_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing OpenWeather API key in server environment.' });
        }

        const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${apiKey}`
        );

        const data = await weatherResponse.json();

        if (!weatherResponse.ok) {
            return res.status(weatherResponse.status).json({
                error: data.message || 'Failed to fetch weather data.',
            });
        }

        return res.json({
            city: data.name,
            temperature: data.main.temp,
            feelsLike: data.main.feels_like,
            humidity: data.main.humidity,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            windSpeed: data.wind.speed,
            latitude: data.coord.lat,
            longitude: data.coord.lon,
        });
    } catch (error) {
        console.error('Weather API error:', error);
        return res.status(500).json({ error: 'Server error while fetching weather data.' });
    }
});

module.exports = router;