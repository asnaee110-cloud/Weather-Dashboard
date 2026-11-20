const API_KEY = "6701608573de4b34f6d5feffb6c1280f";
const BASE_URL = "https://api.openweathermap.org/data/2.5";
 
// Elements (ids must match index.html exactly)
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const loader = document.getElementById("loader");
const errorMsg = document.getElementById("errorMsg");
const weatherCard = document.getElementById("weatherCard");
const forecastList = document.getElementById("forecastList");
const favoriteList = document.getElementById("favoriteList");
const themeBtn = document.getElementById("themeBtn");
 
let debounceTimer; // remembered between calls (closure)
let latestRequest = 0; // used to ignore old, slow responses
 
 
// API CALLS 
async function getWeather(city) {
    const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);
 
    // fetch does NOT throw on 404/401, so we check response.ok ourselves
    if (!response.ok) {
        if (response.status === 404) throw new Error("City not found");
        if (response.status === 401) throw new Error("Invalid API key");
        throw new Error("Something went wrong. Please try again.");
    }
 
    const data = await response.json();
 
    return {
        city: data.name,
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        icon: data.weather[0].icon
    };
}
 
async function getForecast(city) {
    const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);
 
    if (!response.ok) {
        throw new Error("Could not load forecast");
    }
 
    const data = await response.json();
 
    // The API gives a reading every 3 hours (40 items).
    // Group them by date, then pick the reading closest to 12:00 for each day.
    const days = {};
    data.list.forEach(function (item) {
        const date = item.dt_txt.slice(0, 10);
        const hour = Number(item.dt_txt.slice(11, 13));
        const distance = Math.abs(hour - 12);
 
        if (!days[date] || distance < days[date].distance) {
            days[date] = { distance: distance, item: item };
        }
    });
 
    return Object.keys(days)
        .slice(0, 5)
        .map(function (date) {
            const item = days[date].item;
            return {
                day: new Date(item.dt * 1000).toLocaleDateString("en-US", { weekday: "short" }),
                temp: Math.round(item.main.temp),
                description: item.weather[0].description,
                icon: item.weather[0].icon
            };
        });
}
 
 
//  UI HELPERS
function showLoader() {
    loader.style.display = "block";
}
 
function hideLoader() {
    loader.style.display = "none";
}
 
function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
}
 
function clearError() {
    errorMsg.textContent = "";
    errorMsg.style.display = "none";
}
 
function iconUrl(code) {
    return `https://openweathermap.org/img/wn/${code}@2x.png`;
}
 
 
//  RENDERING
function renderWeather(weather) {
    weatherCard.innerHTML = `
        <h2>${weather.city}</h2>
        <div class="weather-main">
            <img src="${iconUrl(weather.icon)}" alt="${weather.description}">
            <div>
                <h3>${weather.temp}°C</h3>
                <p>${weather.description}</p>
            </div>
        </div>
        <div class="weather-details">
            <div>Feels like<p>${weather.feelsLike}°C</p></div>
            <div>Humidity<p>${weather.humidity}%</p></div>
            <div>Wind<p>${weather.windSpeed} m/s</p></div>
        </div>
        <button class="favorite-btn" id="favBtn">⭐ Add to Favorites</button>
    `;
    weatherCard.style.display = "block";
 
    // the button is created by JS, so we attach its listener here
    document.getElementById("favBtn").addEventListener("click", function () {
        addFavorite(weather.city);
    });
}
 
function renderForecast(days) {
    forecastList.innerHTML = "";
 
    days.forEach(function (day) {
        const card = document.createElement("div");
        card.className = "forecast-card";
        card.innerHTML = `
            <p>${day.day}</p>
            <img src="${iconUrl(day.icon)}" alt="${day.description}">
            <h4>${day.temp}°C</h4>
            <p>${day.description}</p>
        `;
        forecastList.appendChild(card);
    });
}
 
 
//  SEARCH 
async function searchWeather(city) {
    city = city.trim();
 
    if (city === "") {
        showError("Please enter a city name");
        return;
    }
 
    const requestId = ++latestRequest;
 
    clearError();
    weatherCard.style.display = "none";
    forecastList.innerHTML = "";
    showLoader();
 
    try {
        // run both requests at the same time (faster than one after the other)
        const [weather, forecast] = await Promise.all([
            getWeather(city),
            getForecast(city)
        ]);
 
        // if the user searched again while we waited, ignore this old result
        if (requestId !== latestRequest) return;
 
        renderWeather(weather);
        renderForecast(forecast);
    } catch (error) {
        if (requestId !== latestRequest) return;
 
        if (error instanceof TypeError) {
            showError("Network problem. Check your internet connection.");
        } else {
            showError(error.message);
        }
    } finally {
        if (requestId === latestRequest) {
            hideLoader();
        }
    }
}
 
 
//  DEBOUNCE
function debounceSearch() {
    clearTimeout(debounceTimer); // cancel the previous timer
 
    debounceTimer = setTimeout(function () {
        // avoid searching for tiny, half-typed names like "ko"
        if (cityInput.value.trim().length >= 3) {
            searchWeather(cityInput.value);
        }
    }, 500);
}
 
 
//   FAVORITES (localStorage) 
function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem("favorites")) || [];
    } catch (error) {
        return [];
    }
}
 
function saveFavorites(favorites) {
    localStorage.setItem("favorites", JSON.stringify(favorites));
}
 
function addFavorite(city) {
    const favorites = getFavorites();
 
    const exists = favorites.some(function (item) {
        return item.toLowerCase() === city.toLowerCase();
    });
 
    if (exists) {
        showError(`${city} is already in your favorites`);
        return;
    }
 
    clearError();
    favorites.push(city);
    saveFavorites(favorites);
    loadFavorites();
}
 
function removeFavorite(city) {
    const favorites = getFavorites().filter(function (item) {
        return item !== city;
    });
    saveFavorites(favorites);
    loadFavorites();
}
 
function loadFavorites() {
    const favorites = getFavorites();
    favoriteList.innerHTML = "";
 
    if (favorites.length === 0) {
        favoriteList.textContent = "No favorites yet";
        return;
    }
 
    favorites.forEach(function (city) {
        const item = document.createElement("div");
        item.className = "favorite-item";
 
        const cityBtn = document.createElement("button");
        cityBtn.className = "city-btn";
        cityBtn.type = "button";
        cityBtn.textContent = city;
        cityBtn.addEventListener("click", function () {
            cityInput.value = city;
            searchWeather(city);
        });
 
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.type = "button";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function () {
            removeFavorite(city);
        });
 
        item.appendChild(cityBtn);
        item.appendChild(removeBtn);
        favoriteList.appendChild(item);
    });
}
 
 
// THEME
function applyTheme(theme) {
    if (theme === "dark") {
        document.body.classList.add("dark");
        themeBtn.textContent = "☀️ Light";
    } else {
        document.body.classList.remove("dark");
        themeBtn.textContent = "🌙 Dark";
    }
}
 
function toggleTheme() {
    const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
}
 
 
//  EVENT LISTENERS
document.addEventListener("DOMContentLoaded", function () {
    applyTheme(localStorage.getItem("theme") || "light");
    loadFavorites();
 
    // form submit: runs for button click AND Enter key
    searchForm.addEventListener("submit", function (event) {
        event.preventDefault(); // stop the page from reloading
        clearTimeout(debounceTimer); // cancel any waiting debounced search
        searchWeather(cityInput.value);
    });
 
    // debounced search while typing
    cityInput.addEventListener("input", debounceSearch);
 
    themeBtn.addEventListener("click", toggleTheme);
});
 
