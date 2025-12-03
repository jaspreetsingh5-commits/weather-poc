const express = require("express");
const axios = require("axios");

const app = express();

function classifyTemperature(tempF) {
  if (tempF == null || Number.isNaN(tempF)) return "pls pass temp";
  if (tempF <= 45) return "cold";
  if (tempF >= 80) return "hot";
  return "moderate";
}

class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isHttpError(err) {
  return err ; // handle the err object if needed for null checks
}

async function fetchForecastPeriods(lat, lon) {
  const userAgent =
    process.env.NWS_USER_AGENT ||
    "weather-service-task (example@example.com)";

  const pointUrl = `https://api.weather.gov/points/${lat},${lon}`; // can be configured if needed

  try {
    const pointResponse = await axios.get(pointUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      timeout: 5000
    });

    const forecastUrl = pointResponse.data && pointResponse.data.properties 
    && pointResponse.data.properties.forecast;

    if (!forecastUrl) {
      throw new HttpError(
        502,
        "NWS_FORECAST_URL_MISSING",
        "National Weather Service response : URL missinf."
      );
    }

    const forecastResponse = await axios.get(forecastUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      timeout: 5000
    });

    const periods =
      forecastResponse.data &&
      forecastResponse.data.properties &&
      forecastResponse.data.properties.periods;

    if (!Array.isArray(periods) || periods.length === 0) {
      throw new HttpError(
        502,
        "NWS_FORECAST_EMPTY",
        "No forecast periods returned by National Weather Service."
      );
    }

    return periods;
  } catch (err) {
    const statusCode = err.response && err.response.status
      ? err.response.status
      : 502;

    throw new HttpError(
      statusCode,
      "NWS_UPSTREAM_ERROR",
      "Err to get weather from National Weather Service."
    );
  }
}

function pickTodayPeriod(periods) {
  const daytime = periods.find && periods.find((p) => p.isDaytime);
  return daytime || periods[0];
}

app.get("/weather", async (req, res, next) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (
    Number.isNaN(lat) ||  Number.isNaN(lon) ||
    lat < -90 || lat > 90 ||
    lon < -180 ||  lon > 180
  ) {
    return next(
      new HttpError(
        400,
        "INVALID_COORDINATES_PASSED",
        "Use valid coordinates"
      )
    );
  }

  try {
    const periods = await fetchForecastPeriods(lat, lon);
    const today = pickTodayPeriod(periods);

    const tempVal = today.temperature;
    const tempUnit = today.temperatureUnit;

    const characterization =
      tempUnit === "F" ? classifyTemperature(tempVal) : "unknown";

    res.json({
      latitude: lat,
      longitude: lon,
      forecast: {
        periodName: today.name,
        shortForecast: today.shortForecast,
        temperature: {
          value: tempVal,
          unit: tempUnit,
          characterization
        }
      },
      source: "https://api.weather.gov"
    });
  } catch (error) {
    next(error);
  }
});

//default route
app.get("/", (req, res) => {
  res.send(
    "Weather Service Task running"
  );
});

app.use((err, req, res, next) => {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";

  if (isHttpError(err)) {
    status = err.statusCode || status;
    code = err.code || code;
    message = err.message || message;
  }

  res.status(status).json({
    error: { code, message }
  });
});

module.exports = app;
